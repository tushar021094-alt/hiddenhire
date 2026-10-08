export type JobAuthenticityTier = "verified" | "likely_authentic" | "review" | "caution";

export type JobAuthenticity = {
  score: number;
  tier: JobAuthenticityTier;
  verifiedJob: boolean;
  verifiedCompany: boolean;
  verifiedRecruiter: boolean;
  sourceVerified: boolean;
  duplicateCount: number;
  flags: string[];
  signals: string[];
};

export type JobAuthenticityInput = {
  source?: string | null;
  company?: string | null;
  companyWebsite?: string | null;
  applicationUrl?: string | null;
  description?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  verifiedCompany?: boolean;
  verifiedRecruiter?: boolean;
  duplicateCount?: number;
  reportCount?: number;
  moderationIssueCount?: number;
};

const TRUSTED_SOURCES = new Set(["greenhouse", "lever", "ashby", "workable", "companydiscovery"]);

const SUSPICIOUS_PATTERNS = [
  /registration\s+fee/i,
  /pay\s+(?:a\s+)?fee/i,
  /security\s+deposit/i,
  /whatsapp\s+only/i,
  /telegram\s+only/i,
  /guaranteed\s+(?:job|placement)/i,
  /crypto(?:currency)?\s+(?:payment|deposit)/i,
  /buy\s+(?:a\s+)?course/i,
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateJobAuthenticity(input: JobAuthenticityInput): JobAuthenticity {
  const source = String(input.source || "").toLowerCase();
  const company = String(input.company || "").trim();
  const description = String(input.description || "").trim();
  const applicationUrl = String(input.applicationUrl || "").trim();
  const duplicateCount = Math.max(0, Number(input.duplicateCount || 0));
  const reportCount = Math.max(0, Number(input.reportCount || 0));
  const moderationIssueCount = Math.max(0, Number(input.moderationIssueCount || 0));
  const sourceVerified = TRUSTED_SOURCES.has(source) || input.source === "HiddenHire";
  const verifiedCompany = Boolean(input.verifiedCompany);
  const verifiedRecruiter = Boolean(input.verifiedRecruiter);

  let score = 50;
  const flags: string[] = [];
  const signals: string[] = [];

  if (sourceVerified) { score += 20; signals.push("trusted job source"); }
  if (verifiedCompany) { score += 18; signals.push("company verified"); }
  if (verifiedRecruiter) { score += 12; signals.push("recruiter verified"); }
  if (input.companyWebsite) { score += 5; signals.push("company website available"); }
  else if (source === "hiddenhire") { flags.push("company website not provided"); score -= 5; }

  if (!company || /unknown|undisclosed/i.test(company)) {
    flags.push("company identity is incomplete"); score -= 18;
  }
  if (!applicationUrl || applicationUrl === "#") {
    flags.push("application destination is missing"); score -= 20;
  }
  if (description.length < 180) {
    flags.push("job description is unusually short"); score -= 8;
  }
  if (input.salaryMin != null && input.salaryMax != null && Number(input.salaryMin) > Number(input.salaryMax)) {
    flags.push("salary range is inconsistent"); score -= 18;
  }
  if (duplicateCount >= 3) {
    flags.push("similar posting pattern detected"); score -= Math.min(18, 6 + (duplicateCount - 3) * 3);
  }
  if (reportCount > 0) {
    flags.push(reportCount + " candidate report" + (reportCount === 1 ? "" : "s"));
    score -= Math.min(25, reportCount * 10);
  }
  if (moderationIssueCount > 0) {
    flags.push("moderation history requires review"); score -= Math.min(30, moderationIssueCount * 15);
  }
  if (SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(description))) {
    flags.push("suspicious payment or contact language"); score -= 30;
  }

  const verifiedJob =
    score >= 85 &&
    ((verifiedCompany && verifiedRecruiter) || (sourceVerified && Boolean(input.companyWebsite))) &&
    flags.length === 0;

  const tier: JobAuthenticityTier =
    verifiedJob ? "verified" : score >= 72 ? "likely_authentic" : score >= 52 ? "review" : "caution";

  if (tier === "likely_authentic") signals.push("no major authenticity conflict detected");
  if (tier === "review") signals.push("additional verification recommended");
  if (tier === "caution") signals.push("candidate caution recommended");

  return {
    score: clamp(score),
    tier,
    verifiedJob,
    verifiedCompany,
    verifiedRecruiter,
    sourceVerified,
    duplicateCount,
    flags: [...new Set(flags)].slice(0, 5),
    signals: [...new Set(signals)].slice(0, 5),
  };
}

export function authenticityLabel(authenticity: JobAuthenticity) {
  if (authenticity.verifiedJob) return "Verified Job";
  if (authenticity.tier === "likely_authentic") return "Likely authentic";
  if (authenticity.tier === "review") return "Review recommended";
  return "Caution advised";
}
