export type CareerStrategySummary = {
  eligible: boolean;
  sampleSize: number;
  headline: string;
  recommendations: string[];
  bottlenecks: string[];
};

type AttributionRecommendation = {
  dimension: string;
  group: string;
  sampleSize: number;
  direction: "positive" | "negative";
  delta: number;
};

type StrategyInput = {
  resolved: number;
  positiveRate: number;
  interviewOrHireRate: number;
  rejected: number;
  attributionRecommendations: AttributionRecommendation[];
};

export function buildCareerStrategy(input: StrategyInput): CareerStrategySummary {
  if (input.resolved < 30) {
    return {
      eligible: false,
      sampleSize: input.resolved,
      headline: "Keep collecting outcome data before changing your approach.",
      recommendations: ["Use the existing queue and application workflows while HiddenHire gathers more outcome evidence."],
      bottlenecks: [],
    };
  }

  const rejectionRate = Math.round((input.rejected / Math.max(input.resolved, 1)) * 100);
  const bottlenecks: string[] = [];

  if (input.positiveRate < 40) {
    bottlenecks.push("Positive outcomes are below 40%; tighten role targeting and application selection.");
  }
  if (input.interviewOrHireRate < 10) {
    bottlenecks.push("Interview/hire outcomes are below 10%; improve application quality and role fit.");
  }
  if (rejectionRate > Math.max(input.interviewOrHireRate * 2, 10)) {
    bottlenecks.push("Rejections materially exceed interviews/hire; reduce low-fit applications.");
  }

  const recommendations = input.attributionRecommendations
    .filter((item) => item.direction === "positive" && item.sampleSize >= 30)
    .slice(0, 3)
    .map((item) => "Prioritize " + item.group + " " + item.dimension + " opportunities; historical positive-outcome rate is +" + item.delta + " points versus baseline.");

  if (recommendations.length === 0) {
    recommendations.push("Keep the current ranking policy; no segment has enough evidence to justify a targeted shift.");
  }

  return {
    eligible: true,
    sampleSize: input.resolved,
    headline: bottlenecks[0] || "Current targeting is converting within the available evidence.",
    recommendations,
    bottlenecks,
  };
}
