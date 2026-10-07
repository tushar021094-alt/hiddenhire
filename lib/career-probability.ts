import type { MatchResult } from "@/lib/job-types";

export type ProbabilityEvidence = {
  sampleSize?: number;
  highScorePositiveRate?: number;
  overallPositiveRate?: number;
  eligible?: boolean;
};

export type OpportunityProbability = {
  interviewProbability: number;
  confidence: "low" | "medium" | "high";
  evidenceLabel: string;
  drivers: Array<{ label: string; value: number; kind: "positive" | "neutral" | "friction" }>;
  friction: string[];
};

function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }

export function estimateInterviewProbability(match: MatchResult, evidence: ProbabilityEvidence = {}): OpportunityProbability {
  const b = match.scoreBreakdown;
  const score = clamp(match.score);
  const opportunity = clamp(match.opportunityScore);
  const role = clamp(match.roleRelevanceScore);
  const skills = clamp(b.skills / 15 * 100);
  const experience = clamp(b.experience / 15 * 100);
  const location = clamp(b.location / 10 * 100);
  const salary = clamp(b.salary / 10 * 100);

  // Conservative funnel estimate. This is intentionally an index-to-probability mapping, not a guarantee.
  let probability = 5 + score * 0.34 + opportunity * 0.10 + role * 0.06 + skills * 0.04 + experience * 0.03;
  if (evidence.eligible && typeof evidence.highScorePositiveRate === "number" && typeof evidence.overallPositiveRate === "number") {
    probability += Math.max(-4, Math.min(4, (evidence.highScorePositiveRate - evidence.overallPositiveRate) * 0.08));
  }
  probability = clamp(probability, 5, 72);

  const drivers: OpportunityProbability["drivers"] = [
    { label: "Match", value: score, kind: score >= 80 ? "positive" : "neutral" },
    { label: "Opportunity", value: opportunity, kind: opportunity >= 75 ? "positive" : "neutral" },
    { label: "Role fit", value: role, kind: role >= 80 ? "positive" : role < 60 ? "friction" : "neutral" },
    { label: "Skills", value: skills, kind: skills >= 75 ? "positive" : skills < 55 ? "friction" : "neutral" },
    { label: "Experience", value: experience, kind: experience >= 75 ? "positive" : experience < 55 ? "friction" : "neutral" },
    { label: "Location", value: location, kind: location >= 80 ? "positive" : location < 60 ? "friction" : "neutral" },
    { label: "Salary", value: salary, kind: salary >= 80 ? "positive" : salary < 60 ? "friction" : "neutral" },
  ];
  const friction: string[] = [...match.missingRequirements];
  if (match.seniorityCompatibility === "LOW") friction.push("Seniority mismatch");
  if (friction.length === 0 && score >= 80) friction.push("No material fit gap detected.");
  const confidence: OpportunityProbability["confidence"] = evidence.eligible && (evidence.sampleSize ?? 0) >= 50 ? "high" : (evidence.sampleSize ?? 0) >= 15 ? "medium" : "low";
  const evidenceLabel = confidence === "high" ? "Calibrated with outcome history" : confidence === "medium" ? "Partially calibrated" : "Model-estimated · more outcome data needed";
  return { interviewProbability: probability, confidence, evidenceLabel, drivers, friction: friction.slice(0, 4) };
}