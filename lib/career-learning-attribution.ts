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

  const attribution = dimensions.map(([dimension, getGroup]) => {
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

  const overallPositiveRate = observations.length
    ? Math.round(observations.filter((x) => POSITIVE.has(x.outcome)).length / observations.length * 100)
    : 0;

  const recommendations = attribution.flatMap((dimension) =>
    dimension.results
      .filter((result) => result.eligible)
      .map((result) => {
        const delta = result.positiveRate - overallPositiveRate;
        if (Math.abs(delta) < 10) return null;
        return {
          dimension: dimension.dimension,
          group: result.group,
          sampleSize: result.sampleSize,
          direction: delta > 0 ? "positive" as const : "negative" as const,
          delta,
          reason: delta > 0
            ? `${result.group} is outperforming the overall positive-outcome rate by ${delta} points.`
            : `${result.group} is underperforming the overall positive-outcome rate by ${Math.abs(delta)} points.`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  ).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

  return { dimensions: attribution, recommendations };
}
