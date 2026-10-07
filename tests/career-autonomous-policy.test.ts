import test from "node:test";
import assert from "node:assert/strict";
import { buildAutonomousScanPolicy } from "@/lib/career-autonomous-policy";

const observation = (index: number, outcome: string) => ({
  action: "apply_now",
  decisionScore: 80,
  outcome,
  source: index % 2 ? "greenhouse" : "lever",
  role: index % 2 ? "Finance" : "Accounting",
  remote: index % 3 === 0,
});

test("autonomous policy holds before enough outcome evidence", () => {
  const policy = buildAutonomousScanPolicy(
    Array.from({ length: 12 }, (_, index) => observation(index, "applied")),
  );
  assert.equal(policy.eligible, false);
  assert.equal(policy.calibrationAdjustment, 0);
  assert.equal(policy.learningPolicy.eligible, false);
});

test("autonomous policy activates attribution after the policy evidence gate", () => {
  const policy = buildAutonomousScanPolicy(
    Array.from({ length: 30 }, (_, index) => observation(index, "interview")),
  );
  assert.equal(policy.eligible, true);
  assert.equal(policy.learningPolicy.eligible, true);
  assert.ok(policy.sampleSize >= 30);
});
