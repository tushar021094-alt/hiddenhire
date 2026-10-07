import type { JobWatchEventType } from "@/lib/job-watch";

export type OpportunitySignalEvent = {
  watch_id: string;
  job_fingerprint: string;
  event_type: JobWatchEventType;
  previous_score?: number | null;
  current_score?: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type OpportunityApplication = {
  status?: string | null;
};

export type OpportunityActionState = {
  action?: string | null;
  taskStatus?: "open" | "completed" | "dismissed" | string | null;
  outcome?: string | null;
};

export type AutonomousOpportunity = {
  jobFingerprint: string;
  title: string;
  company: string;
  location: string;
  applicationUrl: string;
  latestScore: number;
  opportunityScore: number;
  attentionScore: number;
  priority: "act_now" | "review" | "watch" | "ignore";
  reasons: string[];
  eventTypes: JobWatchEventType[];
  watchCount: number;
  watchIds: string[];
  latestEventAt: string;
  firstSeenAt: string;
  trend: "improving" | "stable" | "changed" | "reopened";
  source: string | null;
  applicationStatus: string | null;
  action: string | null;
  taskStatus: string | null;
  isDuplicateAcrossWatches: boolean;
};

const ACTIVE_APPLICATIONS = new Set(["applied", "reviewing", "shortlisted"]);
const CLOSED_APPLICATIONS = new Set(["rejected", "withdrawn", "hired"]);

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function recencyScore(createdAt: string, nowMs: number) {
  const ageDays = Math.max(0, (nowMs - new Date(createdAt).getTime()) / 86_400_000);
  if (ageDays <= 1) return 100;
  if (ageDays <= 3) return 75;
  if (ageDays <= 7) return 45;
  if (ageDays <= 14) return 20;
  return 0;
}

function sourceQuality(source: string | null, applicationUrl: string) {
  const value = `${source || ""} ${applicationUrl}`.toLowerCase();
  if (/greenhouse|lever|ashby|workable/.test(value)) return 100;
  if (/linkedin|indeed|wellfound|foundit|naukri/.test(value)) return 85;
  return 65;
}

function trendFor(events: OpportunitySignalEvent[], latestScore: number) {
  const scores = events
    .map((event) => number(event.current_score, latestScore))
    .filter((score) => Number.isFinite(score));
  const firstScore = scores[0] ?? latestScore;
  const types = new Set(events.map((event) => event.event_type));
  if (types.has("reopened")) return "reopened" as const;
  if (latestScore - firstScore >= 5) return "improving" as const;
  if (types.has("salary_change") || types.has("location_change")) return "changed" as const;
  return "stable" as const;
}

function materialEvent(eventTypes: JobWatchEventType[]) {
  if (eventTypes.includes("reopened")) return 24;
  if (eventTypes.includes("score_increase")) return 18;
  if (eventTypes.includes("salary_change")) return 14;
  if (eventTypes.includes("location_change")) return 11;
  if (eventTypes.includes("new")) return 12;
  return 0;
}

function applicationAdjustment(status: string | null) {
  if (status === "interview") return 28;
  if (status === "shortlisted") return 20;
  if (ACTIVE_APPLICATIONS.has(status || "")) return 12;
  if (status === "hired") return 0;
  if (CLOSED_APPLICATIONS.has(status || "")) return -45;
  return 0;
}

function actionSuppression(
  action: OpportunityActionState | undefined,
  eventTypes: JobWatchEventType[],
) {
  const material = eventTypes.some((type) =>
    ["reopened", "score_increase", "salary_change", "location_change"].includes(type),
  );
  if (!action) return false;
  if (action.taskStatus === "completed" && !material) return true;
  if (action.taskStatus === "dismissed" && !material) return true;
  if (["rejected", "withdrawn"].includes(action.outcome || "") && !material) return true;
  return false;
}

export function consolidateOpportunitySignals(events: OpportunitySignalEvent[]) {
  const grouped = new Map<string, OpportunitySignalEvent[]>();

  for (const event of events) {
    const current = grouped.get(event.job_fingerprint) ?? [];
    current.push(event);
    grouped.set(event.job_fingerprint, current);
  }

  return [...grouped.entries()].map(([jobFingerprint, rawEvents]) => {
    const history = [...rawEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const latest = history[history.length - 1];
    return {
      jobFingerprint,
      events: history,
      latest,
      watchIds: unique(history.map((event) => event.watch_id)),
    };
  });
}

export function buildAutonomousOpportunityIntelligence(
  events: OpportunitySignalEvent[],
  options: {
    applications?: Record<string, OpportunityApplication | undefined>;
    actions?: Record<string, OpportunityActionState | undefined>;
    now?: string;
    limit?: number;
  } = {},
): AutonomousOpportunity[] {
  const nowMs = new Date(options.now ?? new Date().toISOString()).getTime();
  const applications = options.applications ?? {};
  const actions = options.actions ?? {};

  return consolidateOpportunitySignals(events)
    .map(({ jobFingerprint, events: history, latest, watchIds }) => {
      const payload = latest.payload || {};
      const title = text(payload.title, "Opportunity");
      const company = text(payload.company, "Company");
      const location = text(payload.location, "Location");
      const applicationUrl = text(payload.applicationUrl, "#");
      const latestScore = clamp(number(latest.current_score ?? payload.score));
      const opportunityScore = clamp(number(payload.opportunityScore, latestScore));
      const eventTypes = unique(history.map((event) => event.event_type));
      const trend = trendFor(history, latestScore);
      const applicationStatus = applications[jobFingerprint]?.status ?? null;
      const action = actions[jobFingerprint];
      const recent = recencyScore(latest.created_at, nowMs);
      const material = materialEvent(eventTypes);
      const source = text(payload.source, "") || null;

      let attentionScore = clamp(
        latestScore * 0.55 +
        opportunityScore * 0.12 +
        recent * 0.12 +
        material * 0.11 +
        sourceQuality(source, applicationUrl) * 0.05 +
        Math.min(100, watchIds.length * 20) * 0.05 +
        applicationAdjustment(applicationStatus),
      );

      const reasons: string[] = [];
      if (latestScore >= 85) reasons.push(`${latestScore}% match`);
      else if (latestScore >= 75) reasons.push(`${latestScore}% match`);
      if (trend === "improving") reasons.push("match is improving");
      if (trend === "reopened") reasons.push("role reopened");
      if (eventTypes.includes("salary_change")) reasons.push("compensation changed");
      if (eventTypes.includes("location_change")) reasons.push("location changed");
      if (watchIds.length > 1) reasons.push(`found in ${watchIds.length} watches`);
      if (applicationStatus === "interview") reasons.push("interview already active");
      else if (applicationStatus === "shortlisted") reasons.push("application shortlisted");
      else if (ACTIVE_APPLICATIONS.has(applicationStatus || "")) reasons.push("application is active");
      if (recent >= 75) reasons.push("recent signal");

      let priority: AutonomousOpportunity["priority"] =
        attentionScore >= 82 ? "act_now" :
        attentionScore >= 64 ? "review" :
        attentionScore >= 48 ? "watch" :
        "ignore";

      if (applicationStatus === "interview") priority = "act_now";
      if (CLOSED_APPLICATIONS.has(applicationStatus || "") && trend !== "reopened") priority = "ignore";
      if (actionSuppression(action, eventTypes)) priority = "ignore";

      if (priority === "ignore" && reasons.length === 0) reasons.push("below the attention threshold");
      if (!reasons.length) reasons.push("relevant to the monitored pipeline");

      return {
        jobFingerprint,
        title,
        company,
        location,
        applicationUrl,
        latestScore,
        opportunityScore,
        attentionScore,
        priority,
        reasons: unique(reasons).slice(0, 5),
        eventTypes,
        watchCount: watchIds.length,
        watchIds,
        latestEventAt: latest.created_at,
        firstSeenAt: history[0].created_at,
        trend,
        source,
        applicationStatus,
        action: action?.action ?? null,
        taskStatus: action?.taskStatus ?? null,
        isDuplicateAcrossWatches: watchIds.length > 1,
      };
    })
    .sort((a, b) =>
      b.attentionScore - a.attentionScore ||
      new Date(b.latestEventAt).getTime() - new Date(a.latestEventAt).getTime(),
    )
    .slice(0, options.limit ?? 50);
}

export function priorityLabel(priority: AutonomousOpportunity["priority"]) {
  return {
    act_now: "ACT NOW",
    review: "REVIEW",
    watch: "WATCH",
    ignore: "IGNORE",
  }[priority];
}
