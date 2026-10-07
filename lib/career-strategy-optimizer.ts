import type { MatchResult } from "@/lib/job-types";
import type { CareerSimulation, CareerSimulationChanges } from "@/lib/career-simulation";

export type CareerStrategyCandidate = {
  id: string;
  label: string;
  description: string;
  changes: CareerSimulationChanges;
};

export type CareerStrategyRecommendation = CareerStrategyCandidate & {
  rank: number;
  score: number;
  highProbabilityDelta: number;
  strongMatchDelta: number;
  opportunityDelta: number;
  averageInterviewProbabilityDelta: number;
  simulation: CareerSimulation;
};

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function generateCareerStrategyCandidates(
  matches: MatchResult[],
  currentMinimumSalary: number,
  remoteOnly: boolean,
): CareerStrategyCandidate[] {
  const existingSkills = new Set<string>();
  const locationsInProfile = new Set<string>();
  const missingSkills = unique(
    matches.flatMap((match) => match.job.requiredSkills ?? []).filter((skill) => {
      const key = skill.trim().toLowerCase();
      if (!key || existingSkills.has(key)) return false;
      return true;
    }),
  ).slice(0, 2);

  const locations = unique(matches.map((match) => match.job.location || ""))
    .filter((location) => !/remote|anywhere|india/i.test(location))
    .slice(0, 2);

  void locationsInProfile;

  const candidates: CareerStrategyCandidate[] = [];

  if (missingSkills.length) {
    candidates.push({
      id: "skills",
      label: "Add the highest-value missing skills",
      description: "Test skills already appearing as requirements in your strongest opportunities.",
      changes: { addSkills: missingSkills },
    });
  }

  if (locations.length) {
    candidates.push({
      id: "locations",
      label: "Expand your location range",
      description: "Test nearby opportunity locations already present in the current market.",
      changes: { addLocations: locations },
    });
  }

  if (currentMinimumSalary > 0) {
    const lowerSalary = Math.max(0, Math.round(currentMinimumSalary * 0.9 / 50000) * 50000);
    if (lowerSalary < currentMinimumSalary) {
      candidates.push({
        id: "salary",
        label: "Lower the salary floor by 10%",
        description: "Measure the opportunity gain before permanently changing your target compensation.",
        changes: { minimumSalary: lowerSalary },
      });
    }
  }

  if (!remoteOnly) {
    candidates.push({
      id: "remote",
      label: "Allow remote opportunities",
      description: "Test remote access without changing your location preferences.",
      changes: { remoteOnly: true },
    });
  }

  return candidates;
}

export function rankCareerStrategies(
  candidates: Array<CareerStrategyCandidate & { simulation: CareerSimulation }>,
): CareerStrategyRecommendation[] {
  return candidates
    .map((candidate) => {
      const { deltas } = candidate.simulation;
      const score =
        deltas.highProbability * 5 +
        deltas.strongMatches * 3 +
        deltas.opportunities * 1 +
        deltas.averageInterviewProbability * 0.5;
      return {
        ...candidate,
        rank: 0,
        score: Math.round(score * 10) / 10,
        highProbabilityDelta: deltas.highProbability,
        strongMatchDelta: deltas.strongMatches,
        opportunityDelta: deltas.opportunities,
        averageInterviewProbabilityDelta: deltas.averageInterviewProbability,
      };
    })
    .sort((a, b) =>
      b.score - a.score ||
      b.highProbabilityDelta - a.highProbabilityDelta ||
      b.strongMatchDelta - a.strongMatchDelta
    )
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
