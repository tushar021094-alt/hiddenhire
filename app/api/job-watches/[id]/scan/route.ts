import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildJobFingerprint, classifyWatchEvent, eventPriority, type WatchableMatch } from "@/lib/job-watch";
import { searchJobs } from "@/lib/job-search-service";

type Context = { params: Promise<{ id: string }> };

const MAX_MATCHES = 100;

export async function POST(request: Request, context: Context) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { id } = await context.params;
  const { data: watch, error: watchError } = await supabase.from("job_watches").select("*").eq("id", id).eq("candidate_id", user.id).maybeSingle();
  if (watchError) return NextResponse.json({ error: "Unable to load job watch." }, { status: 500 });
  if (!watch) return NextResponse.json({ error: "Job watch not found." }, { status: 404 });
  if (!watch.enabled) return NextResponse.json({ error: "This job watch is disabled." }, { status: 409 });

  const body = await request.json().catch(() => null);
  let matches = body && typeof body === "object" && Array.isArray((body as { matches?: unknown }).matches)
    ? (body as { matches: unknown[] }).matches.slice(0, MAX_MATCHES)
    : [];

  if (matches.length === 0) {
    const searchResult = await searchJobs({
      targetJobTitle: Array.isArray(watch.target_roles) ? watch.target_roles[0] || "Finance Manager" : "Finance Manager",
      targetRoles: Array.isArray(watch.target_roles) ? watch.target_roles : [],
      preferredLocations: Array.isArray(watch.preferred_locations) ? watch.preferred_locations : [],
      preferredCountries: Array.isArray(watch.preferred_countries) ? watch.preferred_countries : ["India"],
      skills: Array.isArray(watch.skills) ? watch.skills : [],
      minimumSalary: Number(watch.minimum_salary ?? 0),
      preferredCurrency: typeof watch.currency === "string" ? watch.currency : "INR",
      remoteOnly: Boolean(watch.remote_only),
    });
    matches = Array.isArray(searchResult.results) ? searchResult.results.slice(0, MAX_MATCHES) : [];
  }

  const usable = matches.filter((item): item is WatchableMatch =>
    Boolean(item && typeof item === "object" && (item as WatchableMatch).job &&
      typeof (item as WatchableMatch).job.title === "string" &&
      typeof (item as WatchableMatch).job.company === "string" &&
      typeof (item as WatchableMatch).job.location === "string" &&
      typeof (item as WatchableMatch).job.applicationUrl === "string")
  );

  const fingerprints = usable.map((match) => buildJobFingerprint(match.job));
  const { data: previousEvents, error: previousError } = fingerprints.length
    ? await supabase.from("job_watch_events")
        .select("job_fingerprint,event_type,previous_score,current_score,payload,created_at")
        .eq("watch_id", id)
        .in("job_fingerprint", [...new Set(fingerprints)])
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (previousError) return NextResponse.json({ error: "Unable to inspect previous watch state." }, { status: 500 });

  const latest = new Map<string, { score: number; salaryMin: number | null; salaryMax: number | null; location: string | null; createdAt: string }>();
  for (const event of previousEvents ?? []) {
    if (latest.has(event.job_fingerprint)) continue;
    const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {};
    latest.set(event.job_fingerprint, {
      score: Number(event.current_score ?? 0),
      salaryMin: typeof payload.salaryMin === "number" ? payload.salaryMin : null,
      salaryMax: typeof payload.salaryMax === "number" ? payload.salaryMax : null,
      location: typeof payload.location === "string" ? payload.location : null,
      createdAt: event.created_at,
    });
  }

  const events: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const match of usable) {
    const score = Number(match.score ?? 0);
    if (score < Number(watch.min_match_score ?? 70)) continue;

    const fingerprint = buildJobFingerprint(match.job);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const previous = latest.get(fingerprint);
    const eventType = classifyWatchEvent(previous ? {
      score: previous.score,
      salaryMin: previous.salaryMin,
      salaryMax: previous.salaryMax,
      location: previous.location,
    } : null, match);

    if (previous && eventType === "reopened") continue;

    const priority = eventPriority(eventType, score);
    const payload = {
      title: match.job.title,
      company: match.job.company,
      location: match.job.location,
      salaryMin: match.job.salaryMin ?? null,
      salaryMax: match.job.salaryMax ?? null,
      applicationUrl: match.job.applicationUrl,
      remote: Boolean(match.job.remote),
      postedDate: match.job.postedDate ?? null,
      priority,
      watchName: watch.name,
    };

    const recentDuplicate = (previousEvents ?? []).some((event) =>
      event.job_fingerprint === fingerprint &&
      event.event_type === eventType &&
      Date.now() - new Date(event.created_at).getTime() < 86_400_000
    );
    if (recentDuplicate) continue;

    events.push({
      watch_id: id,
      job_fingerprint: fingerprint,
      event_type: eventType,
      previous_score: previous?.score ?? null,
      current_score: score,
      payload,
    });
  }

  if (events.length) {
    const { error: insertError } = await supabase.from("job_watch_events").insert(events);
    if (insertError) return NextResponse.json({ error: "Unable to save watch events." }, { status: 500 });
  }

  const { error: touchError } = await supabase.from("job_watches").update({
    last_scanned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("candidate_id", user.id);
  if (touchError) return NextResponse.json({ error: "Watch events saved, but scan timestamp could not be updated." }, { status: 500 });

  return NextResponse.json({
    success: true,
    scanned: usable.length,
    threshold: Number(watch.min_match_score ?? 70),
    eventsCreated: events.length,
    events,
  });
}
