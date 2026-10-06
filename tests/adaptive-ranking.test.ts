import test from "node:test";
import assert from "node:assert/strict";
import { applyLearningPolicy, buildAttributionInsights, getLearningPolicyAdjustment } from "../lib/career-learning-attribution";

test("adaptive ranking remains inactive until sufficient evidence exists", () => {
  const policy = buildAttributionInsights(Array.from({ length: 29 }, (_, i) => ({
    action: "apply_now",
    decisionScore: 90,
    outcome: i < 25 ? "interview" : "rejected",
    source: "greenhouse",
    role: "Finance",
    remote: false,
  }))).policy;

  assert.equal(policy.eligible, false);
  assert.equal(getLearningPolicyAdjustment({ source: "greenhouse", role: "Finance", remote: false, score: 90 }, policy), 0);
});

test("adaptive ranking applies eligible score-band and source evidence", () => {
  const observations = [
    ...Array.from({ length: 35 }, () => ({ action: "apply_now", decisionScore: 90, outcome: "interview", source: "greenhouse", role: "Finance", remote: false })),
    ...Array.from({ length: 35 }, () => ({ action: "review", decisionScore: 60, outcome: "rejected", source: "other", role: "Sales", remote: true })),
  ];

  const policy = buildAttributionInsights(observations).policy;
  assert.equal(policy.eligible, true);

  const adjustment = getLearningPolicyAdjustment(
    { source: "greenhouse", role: "Finance", remote: false, score: 90 },
    policy,
  );

  assert.ok(adjustment > 0);
  assert.ok(applyLearningPolicy(82, { source: "greenhouse", role: "Finance", remote: false, score: 90 }, policy) > 82);
});
