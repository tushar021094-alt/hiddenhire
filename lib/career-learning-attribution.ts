import { CareerLearningObservation } from "@/lib/career-learning";

export type CareerAttributionObservation = CareerLearningObservation & {
  source: string;
  role: string;
  remote: boolean;
};

const POSITIVE = new Set(["applied", "reviewing", "shortlisted", "interview", "hired"]);
const STRONG = new Set(["interview", "hired"]);
const MIN_SAMPLE = 20;

function scoreBand(score: number) {
  if (score >= 85) return "85-100";
  if (score >= 75) return "75-84";
  if (score >= 65) return "65-74";
  return "0-64";
}

export function buildAttributionInsights(observations: CareerAttributionObservation[]) {
  const dimensions = [
    ["source", (x: CareerAttributionObservation) => x.source || "unknown"],
    ["role", (x: CareerAttributionObservation) => x.role || "unknown"],
    ["score_band", (x: CareerAttributionObservation) => scoreBand(x.decisionScore)],
    ["remote", (x: CareerAttributionObservation) => x.remote ? "remote" : "non_remote"],
  ] as const;

  return dimensions.map(([dimension, getGroup]) => {
    const groups = new Map<string, CareerAttributionObservation[]>();
    for (const observation of observations) {
      const key = getGroup(observation);
      groups.set(key, [...(groups.get(key) ?? []), observation]);
    }
    return {
      dimension,
      results: [...groups.entries()].map(([group, items]) => ({
        group,
        sampleSize: items.length,
        eligible: items.length >= MIN_SAMPLE,
        positiveRate: Math.round(items.filter((x) => POSITIVE.has(x.outcome)).length / Math.max(items.length, 1) * 100),
        interviewOrHireRate: Math.round(items.filter((x) => STRONG.has(x.outcome)).length / Math.max(items.length, 1) * 100),
      })).sort((a, b) => b.sampleSize - a.sampleSize),
    };
  });
}
