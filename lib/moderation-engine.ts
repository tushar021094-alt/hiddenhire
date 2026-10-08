export type ModerationDecision = "allow" | "warn" | "restrict" | "escalate";
export type ModerationQueue = "none" | "monitor" | "review" | "urgent";

export type ModerationAssessment = {
  decision: ModerationDecision;
  queue: ModerationQueue;
  priority: number;
  reasons: string[];
};

export function assessMarketplaceModeration(input: {
  safetyScore: number;
  safetyTier: "low" | "guarded" | "high" | "critical";
  safetyAction: ModerationDecision;
  authenticityScore: number;
  reportCount: number;
  moderationIssueCount: number;
  recruiterTrustScore?: number;
}) : ModerationAssessment {
  const reasons: string[] = [];
  let priority = 0;

  if (input.safetyTier === "critical") { priority += 70; reasons.push("critical safety risk"); }
  else if (input.safetyTier === "high") { priority += 50; reasons.push("high safety risk"); }
  else if (input.safetyTier === "guarded") { priority += 25; reasons.push("guarded safety risk"); }

  if (input.reportCount > 0) {
    priority += Math.min(25, input.reportCount * 8);
    reasons.push("candidate reports");
  }
  if (input.moderationIssueCount > 0) {
    priority += Math.min(30, input.moderationIssueCount * 12);
    reasons.push("moderation history");
  }
  if (input.authenticityScore < 52) {
    priority += 20;
    reasons.push("low authenticity");
  }
  if (input.recruiterTrustScore != null && input.recruiterTrustScore < 50) {
    priority += 8;
    reasons.push("limited recruiter trust history");
  }

  priority = Math.min(100, priority);
  const queue: ModerationQueue =
    priority >= 75 ? "urgent" :
    priority >= 45 ? "review" :
    priority >= 20 ? "monitor" :
    "none";

  return {
    decision: input.safetyAction,
    queue,
    priority,
    reasons: [...new Set(reasons)].slice(0, 5),
  };
}

export function moderationLabel(assessment: ModerationAssessment) {
  if (assessment.queue === "urgent") return "Urgent moderation";
  if (assessment.queue === "review") return "Moderation review";
  if (assessment.queue === "monitor") return "Monitor";
  return "No moderation action";
}
