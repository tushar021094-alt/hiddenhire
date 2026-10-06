export type ScoreCalibrationObservation = {
  score: number;
  outcome: string;
};

const POSITIVE = new Set(["applied", "reviewing", "shortlisted", "interview", "hired"]);
const MIN_SAMPLE = 50;
const MAX_ADJUSTMENT = 3;

export function calibrateScore(observations: ScoreCalibrationObservation[]) {
  if (observations.length < MIN_SAMPLE) {
    return { eligible: false, sampleSize: observations.length, adjustment: 0, reason: `Need at least ${MIN_SAMPLE} resolved outcomes.` };
  }

  const positiveRate = observations.filter((x) => POSITIVE.has(x.outcome)).length / observations.length;
  const highScore = observations.filter((x) => x.score >= 85);
  const lowScore = observations.filter((x) => x.score < 85);
  const highRate = highScore.length ? highScore.filter((x) => POSITIVE.has(x.outcome)).length / highScore.length : positiveRate;
  const lowRate = lowScore.length ? lowScore.filter((x) => POSITIVE.has(x.outcome)).length / lowScore.length : positiveRate;
  const delta = highRate - lowRate;

  const adjustment = delta >= 0.15 ? MAX_ADJUSTMENT : delta <= -0.15 ? -MAX_ADJUSTMENT : 0;
  return {
    eligible: true,
    sampleSize: observations.length,
    adjustment,
    highScorePositiveRate: Math.round(highRate * 100),
    lowScorePositiveRate: Math.round(lowRate * 100),
    overallPositiveRate: Math.round(positiveRate * 100),
    reason: adjustment > 0 ? "High-score opportunities are materially outperforming lower-score opportunities." : adjustment < 0 ? "High-score opportunities are not outperforming lower-score opportunities; keep ranking conservative." : "Score-band performance is not sufficiently separated.",
  };
}

export function applyScoreCalibration(baseScore: number, adjustment: number) {
  return Math.max(0, Math.min(100, Math.round(baseScore + Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, adjustment)))));
}
