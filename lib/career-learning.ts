export type CareerLearningObservation = {
  action: string;
  decisionScore: number;
  outcome: string;
};

export type CareerLearningInsight = {
  sampleSize: number;
  eligible: boolean;
  recommendation: "hold" | "increase" | "decrease";
  scoreAdjustment: number;
  reason: string;
};

const POSITIVE = new Set(["applied", "reviewing", "shortlisted", "interview", "hired"]);
const STRONG_POSITIVE = new Set(["interview", "hired"]);
const MIN_SAMPLE = 20;

export function evaluateLearning(observations: CareerLearningObservation[]): CareerLearningInsight {
  const sampleSize = observations.length;
  if (sampleSize < MIN_SAMPLE) {
    return {
      sampleSize,
      eligible: false,
      recommendation: "hold",
      scoreAdjustment: 0,
      reason: `Need at least ${MIN_SAMPLE} resolved outcomes before changing ranking weights.`,
    };
  }

  const positive = observations.filter((item) => POSITIVE.has(item.outcome)).length;
  const strongPositive = observations.filter((item) => STRONG_POSITIVE.has(item.outcome)).length;
  const positiveRate = positive / sampleSize;
  const strongRate = strongPositive / sampleSize;

  if (strongRate >= 0.25 || positiveRate >= 0.65) {
    return {
      sampleSize,
      eligible: true,
      recommendation: "increase",
      scoreAdjustment: 3,
      reason: `Resolved outcomes are converting strongly (${Math.round(positiveRate * 100)}% positive, ${Math.round(strongRate * 100)}% interview/hired).`,
    };
  }

  if (positiveRate <= 0.2) {
    return {
      sampleSize,
      eligible: true,
      recommendation: "decrease",
      scoreAdjustment: -3,
      reason: `Resolved outcomes are converting weakly (${Math.round(positiveRate * 100)}% positive).`,
    };
  }

  return {
    sampleSize,
    eligible: true,
    recommendation: "hold",
    scoreAdjustment: 0,
    reason: `Outcome signal is mixed (${Math.round(positiveRate * 100)}% positive); keep the current ranking stable.`,
  };
}

export function buildLearningInsights(observations: CareerLearningObservation[]) {
  const byAction = new Map<string, CareerLearningObservation[]>();
  for (const observation of observations) {
    const current = byAction.get(observation.action) ?? [];
    current.push(observation);
    byAction.set(observation.action, current);
  }

  return [...byAction.entries()].map(([action, items]) => ({
    action,
    ...evaluateLearning(items),
  })).sort((a, b) => b.sampleSize - a.sampleSize);
}
