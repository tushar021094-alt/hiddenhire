export type CareerQueueItem = {
  id: string;
  job_fingerprint: string;
  action: string;
  decision_score: number;
  due_at: string | null;
  created_at: string;
  outcome?: string | null;
  application_status?: string | null;
  effective_status: "open" | "completed" | "dismissed";
  [key: string]: unknown;
};

const ACTION_PRIORITY: Record<string, number> = {
  prepare: 100,
  follow_up: 95,
  apply_now: 90,
  review: 72,
  watch: 35,
};

const OUTCOME_PRIORITY: Record<string, number> = {
  interview: 30,
  shortlisted: 24,
  reviewing: 18,
  applied: 12,
};

export function optimizeCareerQueue(items: CareerQueueItem[], now = Date.now(), limit = 12) {
  const candidates = items.filter((item) => item.effective_status === "open");
  const bestByFingerprint = new Map<string, CareerQueueItem>();

  for (const item of candidates) {
    const existing = bestByFingerprint.get(item.job_fingerprint);
    if (!existing || queuePriority(item, now) > queuePriority(existing, now)) {
      bestByFingerprint.set(item.job_fingerprint, item);
    }
  }

  return [...bestByFingerprint.values()]
    .map((item) => ({
      ...item,
      priority_score: queuePriority(item, now),
      queue_reason: queueReason(item, now),
    }))
    .sort((a, b) =>
      b.priority_score - a.priority_score ||
      Number(b.decision_score || 0) - Number(a.decision_score || 0) ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .slice(0, Math.max(1, limit));
}

export function queuePriority(item: CareerQueueItem, now = Date.now()) {
  const due = item.due_at ? new Date(item.due_at).getTime() : null;
  const overdueBoost = due !== null && due <= now ? 35 : 0;
  const outcomeBoost = OUTCOME_PRIORITY[item.application_status || item.outcome || ""] || 0;
  const scoreBoost = Math.min(15, Math.round(Number(item.decision_score || 0) / 10));
  return (ACTION_PRIORITY[item.action] || 20) + overdueBoost + outcomeBoost + scoreBoost;
}

function queueReason(item: CareerQueueItem, now: number) {
  const due = item.due_at ? new Date(item.due_at).getTime() : null;
  if (due !== null && due <= now) return "Due now or overdue.";
  if (item.action === "prepare" && ["interview", "shortlisted"].includes(item.application_status || "")) return "Active pipeline stage needs preparation.";
  if (item.action === "follow_up") return "Application follow-up is the next pipeline action.";
  if (item.action === "apply_now") return "High-value application opportunity.";
  if (item.action === "review") return "Strong opportunity needs a decision.";
  return "Monitoring for a stronger signal.";
}
