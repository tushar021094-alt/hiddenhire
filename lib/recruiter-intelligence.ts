import { calculateJobMatch } from "@/lib/match-engine";\ntype MatchResult = ReturnType<typeof calculateJobMatch>;

export type RecruiterCandidateIntelligence = {
  priority: "strong" | "promising" | "review";
  recruiterScore: number;
  fitScore: number;
  readinessScore: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  nextAction: "shortlist" | "review" | "keep_watching";
};

export function buildRecruiterCandidateIntelligence(input: {
  match: MatchResult;
  candidate: {
    skills?: string[] | null;
    experienceYears?: number | null;
    headline?: string | null;
    targetRoles?: string[] | null;
  };
}): RecruiterCandidateIntelligence {
  const fitScore = Math.round(input.match.score);
  const readinessSignals = [
    Boolean(input.candidate.headline?.trim()),
    Array.isArray(input.candidate.skills) && input.candidate.skills.length >= 3,
    Number(input.candidate.experienceYears ?? 0) > 0,
    Array.isArray(input.candidate.targetRoles) && input.candidate.targetRoles.length > 0,
  ];
  const readinessScore = Math.round(readinessSignals.filter(Boolean).length / readinessSignals.length * 100);
  const recruiterScore = Math.max(0, Math.min(100, Math.round(fitScore * 0.8 + readinessScore * 0.2)));
  const confidence = recruiterScore >= 85 ? "high" : recruiterScore >= 70 ? "medium" : "low";
  const priority = recruiterScore >= 85 ? "strong" : recruiterScore >= 70 ? "promising" : "review";
  const reasons = [
    ...input.match.reasons.slice(0, 3),
    ...(readinessScore >= 75 ? ["Candidate profile has enough signal for recruiter review."] : ["Candidate profile has limited readiness signal; verify details before outreach."]),
  ];
  return {
    priority,
    recruiterScore,
    fitScore,
    readinessScore,
    confidence,
    reasons: [...new Set(reasons)],
    nextAction: recruiterScore >= 85 ? "shortlist" : recruiterScore >= 70 ? "review" : "keep_watching",
  };
}
