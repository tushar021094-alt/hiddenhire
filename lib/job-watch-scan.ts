import type { WatchableMatch } from "@/lib/job-watch";
import { buildJobFingerprint, classifyWatchEvent, eventPriority } from "@/lib/job-watch";
import { searchJobs } from "@/lib/job-search-service";

type Watch = {
  id: string;
  name: string;
  candidate_id: string;
  target_roles: string[] | null;
  preferred_locations: string[] | null;
  preferred_countries: string[] | null;
  skills: string[] | null;
  minimum_salary: number | string | null;
  currency: string | null;
  remote_only: boolean | null;
  min_match_score: number | null;
  last_scanned_at?: string | null;
};

type ScanSupabase = ReturnType<typeof import("@/lib/supabase/server")["createClient"]> extends Promise<infer T> ? T : never;

const MAX_MATCHES = 100;
const RECENT_DUPLICATE_MS = 86_400_000;

export async function scanJobWatch(supabase: ScanSupabase, watch: Watch, suppliedMatches?: unknown[]) {
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
    Boolean(item && typeof item === "object" && (item as WatchableMatch).job &&
      typeof (item as WatchableMatch).job.title === "string" &&
      typeof (item as WatchableMatch).job.company === "string" &&
      typeof (item as WatchableMatch).job.location === "string" &&
      typeof (item as WatchableMatch).job.applicationUrl === "string")
  );

  const fingerprints = usable.map((match) => buildJobFingerprint(match.job));
  const uniqueFingerprints = [...new Set(fingerprints)];
  const { data: observations, error: observationError } = uniqueFingerprints.length
    ? await supabase.from("job_watch_observations")
        .select("job_fingerprint,last_seen_at,score,salary_min,salary_max,location")
        .eq("watch_id", watch.id).in("job_fingerprint", uniqueFingerprints)
    : { data: [], error: null };

  if (observationError) throw new Error("Unable to inspect previous watch state.");

  const latest = new Map<string, { score: number; salaryMin: number | null; salaryMax: number | null; location: string | null; lastSeenAt: string }>();
  for (const observation of observations ?? []) {
    latest.set(observation.job_fingerprint, {
      score: Number(observation.score ?? 0),
      salaryMin: observation.salary_min === null ? null : Number(observation.salary_min),
      salaryMax: observation.salary_max === null ? null : Number(observation.salary_max),
      location: typeof observation.location === "string" ? observation.location : null,
      lastSeenAt: observation.last_seen_at,
    });
  }

  const events: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const threshold = Number(watch.min_match_score ?? 70);

  for (const match of usable) {
    const score = Number(match.score ?? 0);
    const fingerprint = buildJobFingerprint(match.job);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const previous = latest.get(fingerprint);
    if (score < threshold) continue;

    const wasAbsentSinceLastScan = Boolean(
      previous && watch.last_scanned_at &&
      new Date(previous.lastSeenAt).getTime() < new Date(watch.last_scanned_at).getTime()
    );

    const eventType = !previous ? "new" :
      wasAbsentSinceLastScan ? "reopened" :
      classifyWatchEvent(previous, match);

    if (previous && eventType === "reopened" && !wasAbsentSinceLastScan) continue;

    const { data: recentDuplicates, error: duplicateError } = await supabase
      .from("job_watch_events").select("id")
      .eq("watch_id", watch.id).eq("job_fingerprint", fingerprint).eq("event_type", eventType)
      .gte("created_at", new Date(Date.now() - RECENT_DUPLICATE_MS).toISOString()).limit(1);
    if (duplicateError) throw new Error("Unable to inspect recent watch events.");
    if (recentDuplicates?.length) continue;

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

    const notifications = events.map((event) => {
      const payload = event.payload as Record<string, unknown>;
      const eventType = String(event.event_type);
      const title =
        eventType === "new" ? "New job match found" :
        eventType === "reopened" ? "Job opportunity reopened" :
        eventType === "score_increase" ? "Job match improved" :
        eventType === "salary_change" ? "Job salary changed" :
        "Job opportunity changed";
      return {
        profile_id: watch.candidate_id,
        type: "job_watch",
        title,
        body: `${String(payload.title || "Role")} at ${String(payload.company || "Unknown company")} — match score ${Number(event.current_score || 0)}/100.`,
        data: {
          watchId: watch.id,
          jobFingerprint: event.job_fingerprint,
          eventType,
          applicationUrl: payload.applicationUrl || null,
          priority: payload.priority || null,
        },
      };
    });

    const { error: notificationError } = await supabase.from("notifications").insert(notifications);
    if (notificationError) throw new Error("Unable to create job watch notifications.");
  }

  const now = new Date().toISOString();
  const observationsToUpsert = usable.map((match) => ({
    watch_id: watch.id,
    job_fingerprint: buildJobFingerprint(match.job),
    last_seen_at: now,
    score: Number(match.score ?? 0),
    salary_min: match.job.salaryMin ?? null,
    salary_max: match.job.salaryMax ?? null,
    location: match.job.location,
    payload: {
      title: match.job.title,
      company: match.job.company,
      applicationUrl: match.job.applicationUrl,
      remote: Boolean(match.job.remote),
      postedDate: match.job.postedDate ?? null,
    },
    updated_at: now,
  }));

  if (observationsToUpsert.length) {
    const { error } = await supabase.from("job_watch_observations")
      .upsert(observationsToUpsert, { onConflict: "watch_id,job_fingerprint" });
    if (error) throw new Error("Unable to save watch observations.");
  }

  const { error: touchError } = await supabase.from("job_watches")
    .update({ last_scanned_at: now, updated_at: now }).eq("id", watch.id);
  if (touchError) throw new Error("Unable to update watch scan timestamp.");

  return { watchId: watch.id, watchName: watch.name, scanned: usable.length, threshold, eventsCreated: events.length, events };
}
