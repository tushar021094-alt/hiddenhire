import type { OpportunityMemory } from "@/lib/opportunity-memory";

export type CareerDecisionAction = "apply_now" | "review" | "prepare" | "follow_up" | "watch" | "ignore";

export type CareerDecision = {
  action: CareerDecisionAction;
  confidence: number;
  reason: string;
  urgency: "high" | "medium" | "low";
};

export function decideOpportunityAction(
  opportunity: OpportunityMemory,
  context: { alreadyApplied?: boolean; hasInterview?: boolean } = {},
): CareerDecision {
  const score = opportunity.latestScore;
  const trend = opportunity.trend;
  if (context.hasInterview) return { action: "prepare", confidence: 98, reason: "You already have an active interview for this opportunity.", urgency: "high" };
  if (context.alreadyApplied) return { action: "follow_up", confidence: score >= 80 ? 94 : 82, reason: trend === "improving" ? "Your match is improving after application." : "This opportunity is already in your application pipeline.", urgency: trend === "improving" ? "high" : "medium" };
  if (score >= 85 && ["improving", "reopened"].includes(trend)) return { action: "apply_now", confidence: 95, reason: trend === "reopened" ? "High-match role has reopened." : "High-match opportunity is becoming more relevant.", urgency: "high" };
  if (score >= 80 && trend === "changed") return { action: "review", confidence: 90, reason: "Strong match with a meaningful compensation or location change.", urgency: "high" };
  if (score >= 75) return { action: "review", confidence: 84, reason: "Strong match is worth reviewing before the next scan.", urgency: "medium" };
  if (score >= 65) return { action: "watch", confidence: 76, reason: "Moderate fit; keep watching for a stronger signal.", urgency: "low" };
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
