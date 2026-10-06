import { CareerLearningObservation } from "@/lib/career-learning";

export type CareerAttributionObservation = CareerLearningObservation & {
  source: string;
  role: string;
  remote: boolean;
};

const POSITIVE = new Set(["applied", "reviewing", "shortlisted", "interview", "hired"]);
const STRONG = new Set(["interview", "hired"]);
const MIN_SAMPLE = 20;
const MIN_POLICY_SAMPLE = 30;

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

  const policy = {
    eligible: observations.length >= MIN_POLICY_SAMPLE,
    sampleSize: observations.length,
    boosts: recommendations.filter((item) => item.direction === "positive" && item.sampleSize >= MIN_POLICY_SAMPLE).map((item) => ({
      dimension: item.dimension,
      group: item.group,
      points: Math.min(2, Math.max(1, Math.round(item.delta / 10))),
    })).slice(0, 3),
    penalties: recommendations.filter((item) => item.direction === "negative" && item.sampleSize >= MIN_POLICY_SAMPLE).map((item) => ({
      dimension: item.dimension,
      group: item.group,
      points: -Math.min(2, Math.max(1, Math.round(Math.abs(item.delta) / 10))),
    })).slice(0, 3),
  };

  return { dimensions: attribution, recommendations, policy };
}

export function getLearningPolicyAdjustment(
  attributes: { source?: string | null; role?: string | null; remote?: boolean | null; score?: number | null },
  policy: ReturnType<typeof buildAttributionInsights>["policy"],
) {
  if (!policy.eligible) return 0;
  let adjustment = 0;
  for (const signal of [...policy.boosts, ...policy.penalties]) {
    const value = signal.dimension === "remote"
      ? (attributes.remote ? "remote" : "non_remote")
      : signal.dimension === "source"
        ? attributes.source || "unknown"
        : signal.dimension === "role"
          ? attributes.role || "unknown"
          : null;
    if (value === signal.group) adjustment += signal.points;
  }
  return Math.max(-4, Math.min(4, adjustment));
}

export function applyLearningPolicy(
  baseScore: number,
  attributes: { source?: string | null; role?: string | null; remote?: boolean | null },
  policy: ReturnType<typeof buildAttributionInsights>["policy"],
) {
  return Math.max(0, Math.min(100, Math.round(baseScore + getLearningPolicyAdjustment(attributes, policy))));
}
