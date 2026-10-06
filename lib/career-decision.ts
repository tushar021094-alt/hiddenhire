import type { OpportunityMemory } from "@/lib/opportunity-memory";

export type CareerDecisionAction = "apply_now" | "review" | "prepare" | "follow_up" | "watch" | "ignore";

export type CareerDecision = {
  action: CareerDecisionAction;
  confidence: number;
  reason: string;
  urgency: "high" | "medium" | "low";
};

export type CareerApplicationContext = {
  status?: string;
};

export type CareerActionHistoryContext = {
  action?: CareerDecisionAction;
  taskStatus?: "open" | "completed" | "dismissed";
  outcome?: string;
};

export function decideOpportunityAction(
  opportunity: OpportunityMemory,
  context: { application?: CareerApplicationContext; alreadyApplied?: boolean; hasInterview?: boolean; priorAction?: CareerActionHistoryContext } = {},
): CareerDecision {
  const score = opportunity.latestScore;
  const trend = opportunity.trend;
  const applicationStatus = context.application?.status;
  const hasInterview = context.hasInterview || applicationStatus === "interview";
  const priorAction = context.priorAction;
  const hasMaterialReactivation = ["reopened", "improving", "changed"].includes(trend);
  if (priorAction?.taskStatus === "completed" && !hasMaterialReactivation) {
    return { action: "ignore", confidence: 93, reason: "This Career Agent task was already completed and the opportunity has no new material signal.", urgency: "low" };
  }
  if (priorAction?.taskStatus === "dismissed" && !hasMaterialReactivation) {
    return { action: "ignore", confidence: 91, reason: "This opportunity was previously dismissed and has not materially changed.", urgency: "low" };
  }

  if (hasInterview) {
    return { action: "prepare", confidence: 98, reason: "You already have an active interview for this opportunity.", urgency: "high" };
  }

  if (["rejected", "withdrawn", "hired"].includes(applicationStatus || "")) {
    if (trend === "reopened" && score >= 85) {
      return { action: "review", confidence: 88, reason: "This opportunity has reopened with a strong match after a previous application outcome.", urgency: "medium" };
    }
    return { action: "ignore", confidence: 92, reason: "This opportunity already has a closed application outcome.", urgency: "low" };
  }

  const isActiveApplication = context.alreadyApplied || ["applied", "reviewing", "shortlisted"].includes(applicationStatus || "");
  if (isActiveApplication) {
    return {
      action: "follow_up",
      confidence: score >= 80 ? 94 : 82,
      reason: trend === "improving"
        ? "Your match is improving while this application remains active."
        : "This opportunity is already in your active application pipeline.",
      urgency: trend === "improving" ? "high" : "medium",
    };
  }

  if (score >= 85 && ["improving", "reopened"].includes(trend)) {
    return { action: "apply_now", confidence: 95, reason: trend === "reopened" ? "High-match role has reopened." : "High-match opportunity is becoming more relevant.", urgency: "high" };
  }

  if (score >= 80 && trend === "changed") {
    return { action: "review", confidence: 90, reason: "Strong match with a meaningful compensation or location change.", urgency: "high" };
  }

  if (score >= 75) {
    return { action: "review", confidence: 84, reason: "Strong match is worth reviewing before the next scan.", urgency: "medium" };
  }

  if (score >= 65) {
    return { action: "watch", confidence: 76, reason: "Moderate fit; keep watching for a stronger signal.", urgency: "low" };
  }

  return { action: "ignore", confidence: 88, reason: "Current fit is below the action threshold.", urgency: "low" };
}

export function decisionLabel(action: CareerDecisionAction) {
  return {
    apply_now: "APPLY NOW",
    review: "REVIEW",
    prepare: "PREPARE",
    follow_up: "FOLLOW UP",
    watch: "WATCH",
    ignore: "IGNORE",
  }[action];
}
