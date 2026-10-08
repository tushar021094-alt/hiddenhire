export type FraudRiskTier = "low" | "guarded" | "high" | "critical";

export type FraudRiskInput = {
  authenticityScore?: number;
  authenticityTier?: "verified" | "likely_authentic" | "review" | "caution";
  reportCount?: number;
  moderationIssueCount?: number;
  duplicateCount?: number;
  recruiterTrustScore?: number;
  recruiterRepeatedNonResponse?: boolean;
  recruiterIdentityVerified?: boolean;
  companyVerified?: boolean;
  suspiciousLanguage?: boolean;
  applicationCount?: number;
};

export type FraudRisk = {
  score: number;
  tier: FraudRiskTier;
  action: "allow" | "warn" | "restrict" | "escalate";
  flags: string[];
  signals: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateFraudRisk(input: FraudRiskInput): FraudRisk {
  let score = 0;
  const flags: string[] = [];
  const signals: string[] = [];

  const authenticity = Number(input.authenticityScore ?? 50);
  const reports = Math.max(0, Number(input.reportCount ?? 0));
  const moderation = Math.max(0, Number(input.moderationIssueCount ?? 0));
  const duplicates = Math.max(0, Number(input.duplicateCount ?? 0));
  const recruiterTrust = Number(input.recruiterTrustScore ?? 50);

  if (authenticity < 52) {
    score += 30;
    flags.push("job authenticity is low");
  } else if (authenticity < 72) {
    score += 12;
    signals.push("job authenticity needs additional review");
  } else {
    signals.push("job authenticity is supported by positive signals");
  }

  if (reports > 0) {
    score += Math.min(30, reports * 12);
    flags.push(`${reports} candidate report${reports === 1 ? "" : "s"}`);
  }

  if (moderation > 0) {
    score += Math.min(30, moderation * 18);
    flags.push("moderation history detected");
  }

  if (duplicates >= 3) {
    score += Math.min(18, 6 + (duplicates - 3) * 4);
    flags.push("repeated or duplicate posting pattern");
  }

  if (input.suspiciousLanguage) {
    score += 35;
    flags.push("suspicious payment or contact language");
  }

  if (input.recruiterRepeatedNonResponse) {
    score += 12;
    flags.push("repeated recruiter non-response");
  }

  if (recruiterTrust < 50) {
    score += 12;
    signals.push("recruiter trust history is limited");
  } else if (recruiterTrust >= 85) {
    score -= 8;
    signals.push("recruiter trust history is strong");
  }

  if (!input.recruiterIdentityVerified) {
    score += 3;
    signals.push("recruiter identity is not verified");
  }
  if (!input.companyVerified) {
    score += 3;
    signals.push("company is not verified");
  }

  if (input.applicationCount != null && input.applicationCount >= 20 && reports >= 2) {
    score += 10;
    flags.push("multiple candidate concerns at meaningful volume");
  }

  const normalized = clamp(score);
  const tier: FraudRiskTier =
    normalized >= 75 ? "critical" :
    normalized >= 50 ? "high" :
    normalized >= 25 ? "guarded" :
    "low";

  const action =
    tier === "critical" ? "escalate" :
    tier === "high" ? "restrict" :
    tier === "guarded" ? "warn" :
    "allow";

  return {
    score: normalized,
    tier,
    action,
    flags: [...new Set(flags)].slice(0, 6),
    signals: [...new Set(signals)].slice(0, 6),
  };
}

export function fraudRiskLabel(risk: FraudRisk) {
  if (risk.tier === "critical") return "Safety review required";
  if (risk.tier === "high") return "High risk";
  if (risk.tier === "guarded") return "Use caution";
  return "Low risk";
}
