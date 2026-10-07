import type { CandidateProfile, MatchResult } from "@/lib/job-types";
import { estimateInterviewProbability } from "@/lib/career-probability";

export type CareerSimulationChanges = {
  addSkills?: string[];
  addLocations?: string[];
  minimumSalary?: number;
  remoteOnly?: boolean;
};

export type SimulationOpportunity = {
  job: MatchResult["job"];
  baselineScore: number | null;
  simulatedScore: number;
  scoreDelta: number;
  baselineProbability: number | null;
  simulatedProbability: number;
  reason: "new" | "improved" | "regressed" | "unchanged";
};

export type CareerSimulation = {
  baseline: { opportunities: number; strongMatches: number; highProbability: number; averageScore: number; averageInterviewProbability: number };
  simulated: { opportunities: number; strongMatches: number; highProbability: number; averageScore: number; averageInterviewProbability: number };
  deltas: { opportunities: number; strongMatches: number; highProbability: number; averageScore: number; averageInterviewProbability: number };
  newlyUnlocked: SimulationOpportunity[];
  improved: SimulationOpportunity[];
  regressed: SimulationOpportunity[];
  summary: string;
};

function key(match: MatchResult) { return match.job.id || match.job.applicationUrl || match.job.title + "|" + match.job.company; }
function round(value: number) { return Math.round(value * 10) / 10; }

function metrics(matches: MatchResult[]) {
  const probabilities = matches.map((match) => estimateInterviewProbability(match).interviewProbability);
  return {
    opportunities: matches.length,
    strongMatches: matches.filter((match) => match.score >= 85).length,
    highProbability: probabilities.filter((value) => value >= 35).length,
    averageScore: round(matches.length ? matches.reduce((sum, match) => sum + match.score, 0) / matches.length : 0),
    averageInterviewProbability: round(probabilities.length ? probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length : 0),
  };
}

export function applyCareerSimulationChanges(profile: CandidateProfile, changes: CareerSimulationChanges): CandidateProfile {
  const normalize = (value: string) => value.trim().toLowerCase();
  const mergeUnique = (current: string[], additions: string[]) => {
    const seen = new Set(current.map(normalize));
    return [...current, ...additions.map((value) => value.trim()).filter((value) => value && !seen.has(normalize(value)) && seen.add(normalize(value)))];
  };
  return {
    ...profile,
    keySkills: mergeUnique(profile.keySkills ?? [], changes.addSkills ?? []),
    preferredLocations: mergeUnique(profile.preferredLocations ?? [], changes.addLocations ?? []),
    minimumSalary: typeof changes.minimumSalary === "number" && Number.isFinite(changes.minimumSalary) ? Math.max(0, Math.round(changes.minimumSalary)) : profile.minimumSalary,
    remoteOnly: typeof changes.remoteOnly === "boolean" ? changes.remoteOnly : profile.remoteOnly,
  };
}

export function buildCareerSimulation(baselineMatches: MatchResult[], simulatedMatches: MatchResult[]): CareerSimulation {
  const baseline = metrics(baselineMatches);
  const simulated = metrics(simulatedMatches);
  const baselineMap = new Map(baselineMatches.map((match) => [key(match), match]));
  const opportunities = simulatedMatches.map((match) => {
    const previous = baselineMap.get(key(match));
    const baselineScore = previous?.score ?? null;
    const scoreDelta = match.score - (previous?.score ?? match.score);
    const reason: SimulationOpportunity["reason"] = !previous ? "new" : scoreDelta >= 5 ? "improved" : scoreDelta <= -5 ? "regressed" : "unchanged";
    return {
      job: match.job,
      baselineScore,
      simulatedScore: match.score,
      scoreDelta,
      baselineProbability: previous ? estimateInterviewProbability(previous).interviewProbability : null,
      simulatedProbability: estimateInterviewProbability(match).interviewProbability,
      reason,
    };
  });
  const newlyUnlocked = opportunities.filter((item) => item.reason === "new" || (item.baselineScore !== null && item.baselineScore < 55 && item.simulatedScore >= 55)).sort((a, b) => b.simulatedScore - a.simulatedScore).slice(0, 5);
  const improved = opportunities.filter((item) => item.reason === "improved").sort((a, b) => b.scoreDelta - a.scoreDelta).slice(0, 5);
  const regressed = opportunities.filter((item) => item.reason === "regressed").sort((a, b) => a.scoreDelta - b.scoreDelta).slice(0, 5);
  const deltas = {
    opportunities: simulated.opportunities - baseline.opportunities,
    strongMatches: simulated.strongMatches - baseline.strongMatches,
    highProbability: simulated.highProbability - baseline.highProbability,
    averageScore: round(simulated.averageScore - baseline.averageScore),
    averageInterviewProbability: round(simulated.averageInterviewProbability - baseline.averageInterviewProbability),
  };
  const parts: string[] = [];
  if (deltas.highProbability > 0) parts.push(deltas.highProbability + " more high-probability opportunities");
  if (deltas.strongMatches > 0) parts.push(deltas.strongMatches + " more strong matches");
  if (deltas.averageInterviewProbability > 0) parts.push("+" + deltas.averageInterviewProbability + " pts average interview probability");
  if (deltas.opportunities > 0 && parts.length === 0) parts.push(deltas.opportunities + " more opportunities");
  const summary = parts.length
    ? "This scenario expands your opportunity set: " + parts.join(", ") + "."
    : deltas.opportunities < 0 || deltas.strongMatches < 0
      ? "This scenario reduces your current opportunity coverage. Review the trade-off before changing your profile."
      : "This scenario produces only a limited change in the current opportunity set.";
  return { baseline, simulated, deltas, newlyUnlocked, improved, regressed, summary };
}
