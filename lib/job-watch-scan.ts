import type { WatchableMatch } from "@/lib/job-watch";
import {
  buildJobFingerprint,
  classifyWatchEvent,
  eventPriority,
} from "@/lib/job-watch";
import { searchJobs } from "@/lib/job-search-service";

type Watch = {
  id: string;
  name: string;
  target_roles: string[] | null;
  preferred_locations: string[] | null;
  preferred_countries: string[] | null;
  skills: string[] | null;
  minimum_salary: number | string | null;
  currency: string | null;
  remote_only: boolean | null;
  min_match_score: number | null;
};

type ScanSupabase = ReturnType<typeof import("@/lib/supabase/server")["createClient"]> extends Promise<infer T> ? T : never;

const MAX_MATCHES = 100;
const RECENT_DUPLICATE_MS = 86_400_000;

export async function scanJobWatch(
  supabase: ScanSupabase,
  watch: Watch,
  suppliedMatches?: unknown[],
) {
  let matches = Array.isArray(suppliedMatches) ? suppliedMatches.slice(0, MAX_MATCHES) : [];

  if (matches.length === 0) {
    const searchResult = await searchJobs({
      targetJobTitle: watch.target_roles?.[0] || "Finance Manager",
      targetRoles: watch.target_roles || [],
      preferredLocations: watch.preferred_locations || [],
      preferredCountries: watch.preferred_countries || ["India"],
      skills: watch.skills || [],
      minimumSalary: Number(watch.minimum_salary ?? 0),
      preferredCurrency: watch.currency || "INR",
      remoteOnly: Boolean(watch.remote_only),
    });
    matches = Array.isArray(searchResult.results) ? searchResult.results.slice(0, MAX_MATCHES) : [];
  }

  const usable = matches.filter((item): item is WatchableMatch =>
    Boolean(
      item &&
      typeof item === "object" &&
      (item as WatchableMatch).job &&
      typeof (item as WatchableMatch).job.title === "string" &&
      typeof (item as WatchableMatch).job.company === "string" &&
      typeof (item as WatchableMatch).job.location === "string" &&
      typeof (item as WatchableMatch).job.applicationUrl === "string",
    ),
  );

  const fingerprints = usable.map((match) => buildJobFingerprint(match.job));
  const { data: previousEvents, error: previousError } = fingerprints.length
    ? await supabase
        .from("job_watch_events")
        .select("job_fingerprint,event_type,previous_score,current_score,payload,created_at")
        .eq("watch_id", watch.id)
        .in("job_fingerprint", [...new Set(fingerprints)])
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (previousError) throw new Error("Unable to inspect previous watch state.");

  const latest = new Map<string, {
    score: number;
    salaryMin: number | null;
    salaryMax: number | null;
    location: string | null;
  }>();

  for (const event of previousEvents ?? []) {
    if (latest.has(event.job_fingerprint)) continue;
    const payload =
      event.payload && typeof event.payload === "object"
        ? event.payload as Record<string, unknown>
        : {};
    latest.set(event.job_fingerprint, {
      score: Number(event.current_score ?? 0),
      salaryMin: typeof payload.salaryMin === "number" ? payload.salaryMin : null,
      salaryMax: typeof payload.salaryMax === "number" ? payload.salaryMax : null,
      location: typeof payload.location === "string" ? payload.location : null,
    });
  }

  const events: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const threshold = Number(watch.min_match_score ?? 70);

  for (const match of usable) {
    const score = Number(match.score ?? 0);
    if (score < threshold) continue;

    const fingerprint = buildJobFingerprint(match.job);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const previous = latest.get(fingerprint);
    const eventType = classifyWatchEvent(
      previous
        ? {
            score: previous.score,
            salaryMin: previous.salaryMin,
            salaryMax: previous.salaryMax,
            location: previous.location,
          }
        : null,
      match,
    );

    if (previous && eventType === "reopened") continue;

    const recentDuplicate = (previousEvents ?? []).some(
      (event) =>
        event.job_fingerprint === fingerprint &&
        event.event_type === eventType &&
        Date.now() - new Date(event.created_at).getTime() < RECENT_DUPLICATE_MS,
    );
    if (recentDuplicate) continue;

    events.push({
      watch_id: watch.id,
      job_fingerprint: fingerprint,
      event_type: eventType,
      previous_score: previous?.score ?? null,
      current_score: score,
      payload: {
        title: match.job.title,
        company: match.job.company,
        location: match.job.location,
        salaryMin: match.job.salaryMin ?? null,
        salaryMax: match.job.salaryMax ?? null,
        applicationUrl: match.job.applicationUrl,
        remote: Boolean(match.job.remote),
        postedDate: match.job.postedDate ?? null,
        priority: eventPriority(eventType, score),
        watchName: watch.name,
      },
    });
  }

  if (events.length) {
    const { error } = await supabase.from("job_watch_events").insert(events);
    if (error) throw new Error("Unable to save watch events.");
  }

  const now = new Date().toISOString();
  const { error: touchError } = await supabase
    .from("job_watches")
    .update({ last_scanned_at: now, updated_at: now })
    .eq("id", watch.id);

  if (touchError) throw new Error("Unable to update watch scan timestamp.");

  return {
    watchId: watch.id,
    watchName: watch.name,
    scanned: usable.length,
    threshold,
    eventsCreated: events.length,
    events,
  };
}
