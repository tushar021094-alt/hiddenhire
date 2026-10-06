import type { JobWatchEventType } from "@/lib/job-watch";

export type OpportunityMemoryEvent = {
  id?: string;
  watch_id: string;
  job_fingerprint: string;
  event_type: JobWatchEventType;
  previous_score: number | null;
  current_score: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type OpportunityMemory = {
  jobFingerprint: string;
  title: string;
  company: string;
  location: string;
  applicationUrl: string;
  latestScore: number;
  peakScore: number;
  firstSeenAt: string;
  lastChangedAt: string;
  eventCount: number;
  eventTypes: JobWatchEventType[];
  trend: "improving" | "stable" | "changed" | "reopened";
  attentionScore: number;
  whyNow: string[];
};

const PRIORITY_SCORE: Record<string, number> = {
  apply_now: 100,
  strong_match: 88,
  review: 68,
  low: 40,
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function score(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function hasEvent(events: OpportunityMemoryEvent[], type: JobWatchEventType) {
  return events.some((event) => event.event_type === type);
}

export function buildOpportunityMemory(events: OpportunityMemoryEvent[]): OpportunityMemory[] {
  const grouped = new Map<string, OpportunityMemoryEvent[]>();

  for (const event of events) {
    const current = grouped.get(event.job_fingerprint) ?? [];
    current.push(event);
    grouped.set(event.job_fingerprint, current);
  }

  return [...grouped.entries()]
    .map(([jobFingerprint, rawEvents]) => {
      const history = [...rawEvents].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const latest = history[history.length - 1];
      const first = history[0];
      const latestScore = score(latest.current_score);
      const peakScore = Math.max(...history.map((event) => score(event.current_score)), latestScore);
      const firstScore = score(first.current_score);
      const eventTypes = unique(history.map((event) => event.event_type));
      const scoreDelta = latestScore - firstScore;
      const reopened = hasEvent(history, "reopened");

      const trend: OpportunityMemory["trend"] =
        reopened ? "reopened" :
        scoreDelta >= 5 ? "improving" :
        eventTypes.some((type) => type === "salary_change" || type === "location_change") ? "changed" :
        "stable";

      const priority = Math.max(
        ...history.map((event) => PRIORITY_SCORE[text(event.payload.priority, "low")] ?? 40),
        latestScore,
      );
      const attentionScore = Math.min(
        100,
        Math.round(
          latestScore * 0.62 +
          Math.min(100, priority) * 0.18 +
          (trend === "improving" ? 10 : trend === "reopened" ? 12 : trend === "changed" ? 7 : 0) +
          (hasEvent(history, "salary_change") ? 4 : 0) +
          (hasEvent(history, "location_change") ? 3 : 0),
        ),
      );

      const whyNow: string[] = [];
      if (latestScore >= 85) whyNow.push(`${latestScore}% match`);
      if (scoreDelta >= 5) whyNow.push(`match improved ${firstScore}% → ${latestScore}%`);
      if (hasEvent(history, "salary_change")) whyNow.push("compensation changed");
      if (hasEvent(history, "location_change")) whyNow.push("location changed");
      if (reopened) whyNow.push("role reopened");
      if (hasEvent(history, "new")) whyNow.push("newly detected");
      if (!whyNow.length) whyNow.push("still relevant to your watch");

      return {
        jobFingerprint,
        title: text(latest.payload.title, "Opportunity"),
        company: text(latest.payload.company, "Company"),
        location: text(latest.payload.location, "Location"),
        applicationUrl: text(latest.payload.applicationUrl, "#"),
        latestScore,
        peakScore,
        firstSeenAt: first.created_at,
        lastChangedAt: latest.created_at,
        eventCount: history.length,
        eventTypes,
        trend,
        attentionScore,
        whyNow: unique(whyNow).slice(0, 4),
      };
    })
    .sort((a, b) => b.attentionScore - a.attentionScore || new Date(b.lastChangedAt).getTime() - new Date(a.lastChangedAt).getTime());
}

export function trendLabel(trend: OpportunityMemory["trend"]) {
  return {
    improving: "IMPROVING",
    stable: "STABLE",
    changed: "CHANGED",
    reopened: "REOPENED",
  }[trend];
}
