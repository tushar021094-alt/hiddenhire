import { calibrateScore } from "@/lib/career-score-calibration";
import { buildAttributionInsights, type CareerAttributionObservation } from "@/lib/career-learning-attribution";

export type AutonomousOutcomeObservation = CareerAttributionObservation;

export type AutonomousScanPolicy = {
  calibrationAdjustment: number;
  learningPolicy: ReturnType<typeof buildAttributionInsights>["policy"];
  eligible: boolean;
  sampleSize: number;
};

export function buildAutonomousScanPolicy(
  observations: AutonomousOutcomeObservation[],
): AutonomousScanPolicy {
  const valid = observations.filter((item) => item.outcome && item.outcome !== "not_started");
  const calibration = calibrateScore(valid.map((item) => ({
    score: Number(item.decisionScore || 0),
    outcome: item.outcome,
  })));
  const attribution = buildAttributionInsights(valid);
  return {
    calibrationAdjustment: calibration.eligible ? calibration.adjustment : 0,
    learningPolicy: attribution.policy,
    eligible: attribution.policy.eligible || calibration.eligible,
    sampleSize: valid.length,
  };
}
