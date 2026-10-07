export type JobWatchEventType = "new" | "score_increase" | "salary_change" | "location_change" | "reopened";

export type WatchableMatch = {
  score?: number;
  opportunityScore?: number;
  roleRelevanceScore?: number;
  job: {
    id?: string;
    title: string;
    company: string;
    location: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    applicationUrl: string;
    remote?: boolean;
    postedDate?: string;
    description?: string | null;
    requiredSkills?: string[];
    requiredExperience?: number | null;
    industry?: string | null;
    source?: string | null;
  };
};

export function normalizeWatchText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeWatchUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return normalizeWatchText(value).replace(/\/$/, "");
  }
}

export function buildJobFingerprint(job: WatchableMatch["job"]) {
  return [
    normalizeWatchText(job.company),
    normalizeWatchText(job.title),
    normalizeWatchUrl(job.applicationUrl),
  ].join("|");
}

export function classifyWatchEvent(
  previous: { score?: number | null; salaryMin?: number | null; salaryMax?: number | null; location?: string | null } | null,
  current: WatchableMatch,
): JobWatchEventType {
  if (!previous) return "new";
  const previousScore = Number(previous.score ?? 0);
  const currentScore = Number(current.score ?? 0);
  if (currentScore - previousScore >= 5) return "score_increase";

  const salaryChanged =
    Number(previous.salaryMin ?? 0) !== Number(current.job.salaryMin ?? 0) ||
    Number(previous.salaryMax ?? 0) !== Number(current.job.salaryMax ?? 0);
  if (salaryChanged) return "salary_change";

  if (normalizeWatchText(previous.location) !== normalizeWatchText(current.job.location)) {
    return "location_change";
  }

  return "reopened";
}

export function eventPriority(eventType: JobWatchEventType, score: number) {
  if (eventType === "new" && score >= 85) return "apply_now";
  if (eventType === "score_increase" && score >= 80) return "strong_match";
  if (eventType === "salary_change" && score >= 75) return "strong_match";
  if (score >= 75) return "strong_match";
  if (score >= 65) return "review";
  return "low";
}
