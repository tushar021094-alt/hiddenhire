import test from "node:test";
import assert from "node:assert/strict";
import { calibrateScore, applyScoreCalibration } from "../lib/career-score-calibration";

test("does not calibrate before minimum evidence", () => {
  const result = calibrateScore(Array.from({ length: 49 }, (_, i) => ({ score: i, outcome: "hired" })));
  assert.equal(result.eligible, false);
  assert.equal(result.adjustment, 0);
});

test("calibration is bounded", () => {
  assert.equal(applyScoreCalibration(99, 100), 100);
  assert.equal(applyScoreCalibration(2, -100), 0);
});

test("strong high-score conversion can increase calibration", () => {
  const observations = [
    ...Array.from({ length: 40 }, () => ({ score: 90, outcome: "interview" })),
    ...Array.from({ length: 20 }, () => ({ score: 70, outcome: "rejected" })),
  ];
  const result = calibrateScore(observations);
  assert.equal(result.eligible, true);
  assert.equal(result.adjustment, 3);
});
