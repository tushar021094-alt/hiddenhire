import type { FraudRiskTier } from "@/lib/fraud-risk";

export type MarketplaceOptimizationAction = "promote" | "prioritize" | "improve" | "limit" | "hold";
export type MarketplaceOptimizationAudience = "candidate" | "recruiter" | "platform";
export type MarketplaceOptimizationInput = {
  audience: MarketplaceOptimizationAudience;
  jobAuthenticityScore?: number | null;
  fraudRiskTier?: FraudRiskTier | null;
  recruiterTrustScore?: number | null;
  recruiterResponseRate?: number | null;
  applications?: number | null;
  qualifiedMatches?: number | null;
  views?: number | null;
  applicationsStarted?: number | null;
  completedApplications?: number | null;
  usageRatio?: number | null;
  isVerified?: boolean;
  hasOpenModerationCase?: boolean;
};
export type MarketplaceOptimizationDecision = {
  action: MarketplaceOptimizationAction;
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  nextStep: string;
};

/**
 * Explainable marketplace guidance. This is advisory ranking logic, not a
 * replacement for the separate safety enforcement gate.
 */
export function optimizeMarketplace(input: MarketplaceOptimizationInput): MarketplaceOptimizationDecision {
  const reasons: string[] = [];
  const risk = input.fraudRiskTier ?? "low";
  const authenticity = input.jobAuthenticityScore ?? 75;
  const trust = input.recruiterTrustScore ?? 50;
  const responseRate = input.recruiterResponseRate ?? 50;
  const views = Math.max(0, input.views ?? 0);
  const starts = Math.max(0, input.applicationsStarted ?? 0);
  const completed = Math.max(0, input.completedApplications ?? 0);
  const matches = Math.max(0, input.qualifiedMatches ?? 0);
  const usageRatio = Math.max(0, input.usageRatio ?? 0);
  let score = 50;

  if (input.hasOpenModerationCase || risk === "critical" || risk === "high") {
    reasons.push(input.hasOpenModerationCase ? "An open moderation case requires review." : `Fraud risk is ${risk}; promotion is not appropriate.`);
    return {
      action: "limit",
      score: 0,
      confidence: "high",
      reasons,
      nextStep: "Keep distribution restricted until a human review clears the safety concern.",
    };
  }

  if (authenticity < 55) {
    score -= 35;
    reasons.push("Job authenticity signals are weak.");
  } else if (authenticity >= 85) {
    score += 12;
    reasons.push("Strong job authenticity signals support visibility.");
  }

  if (!input.isVerified) {
    score -= 8;
    reasons.push("Verification is incomplete.");
  } else {
    score += 8;
    reasons.push("Verification is complete.");
  }

  if (trust < 40) {
    score -= 18;
    reasons.push("Recruiter trust score is low.");
  } else if (trust >= 80) {
    score += 10;
    reasons.push("Recruiter trust score is strong.");
  }

  if (responseRate < 40) {
    score -= 12;
    reasons.push("Recruiter response rate may create a poor candidate experience.");
  } else if (responseRate >= 80) {
    score += 8;
    reasons.push("Recruiter response rate is strong.");
  }

  if (input.audience === "platform" || input.audience === "recruiter") {
    if (views >= 20 && starts / views < 0.03) {
      score -= 12;
      reasons.push("View-to-application-start conversion is low; improve job clarity or fit.");
    } else if (views >= 20 && starts / views >= 0.12) {
      score += 8;
      reasons.push("View-to-application-start conversion is healthy.");
    }

    if (starts >= 10 && completed / starts < 0.35) {
      score -= 10;
      reasons.push("Many candidates start but do not complete applications.");
    } else if (starts >= 10 && completed / starts >= 0.7) {
      score += 6;
      reasons.push("Application completion is healthy.");
    }

    if (matches >= 5 && (input.applications ?? 0) / matches < 0.05) {
      score -= 8;
      reasons.push("Qualified-match conversion is low; review job requirements and targeting.");
    }
  }

  if (usageRatio >= 1) {
    reasons.push("Plan capacity is exhausted; do not silently bypass entitlement limits.");
  } else if (usageRatio >= 0.8) {
    reasons.push("Plan usage is approaching its limit; explain available capacity before upselling.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidence = [input.jobAuthenticityScore, input.recruiterTrustScore, input.recruiterResponseRate, input.views, input.qualifiedMatches]
    .filter((value) => value !== undefined && value !== null).length >= 4 ? "high"
    : [input.jobAuthenticityScore, input.recruiterTrustScore, input.recruiterResponseRate].filter((value) => value !== undefined && value !== null).length >= 2 ? "medium" : "low";

  let action: MarketplaceOptimizationAction;
  let nextStep: string;
  if (usageRatio >= 1) {
    action = "hold";
    nextStep = "Respect the current plan limit and show the user their options; do not block existing access unexpectedly.";
  } else if (score >= 78) {
    action = "promote";
    nextStep = "Consider additional qualified visibility, while monitoring candidate outcomes.";
  } else if (score >= 62) {
    action = "prioritize";
    nextStep = "Keep eligible in normal ranking and direct attention to relevant candidates.";
  } else if (score >= 40) {
    action = "improve";
    nextStep = "Improve job clarity, verification, response expectations, or application conversion before boosting.";
  } else {
    action = "limit";
    nextStep = "Reduce discretionary promotion and review the underlying quality signals.";
  }

  if (!reasons.length) reasons.push("Available marketplace signals do not indicate a specific quality concern.");
  return { action, score, confidence, reasons: reasons.slice(0, 6), nextStep };
}
