import test from "node:test";
import assert from "node:assert/strict";
import { buildAttributionInsights } from "../lib/career-learning-attribution";

test("keeps attribution recommendations gated by sample size", () => {
  const observations = [
    ...Array.from({ length: 19 }, () => ({ action: "apply_now", decisionScore: 90, outcome: "hired", source: "strong-source", role: "Finance", remote: false })),
    ...Array.from({ length: 20 }, () => ({ action: "apply_now", decisionScore: 70, outcome: "rejected", source: "other-source", role: "Sales", remote: true })),
  ];
  const result = buildAttributionInsights(observations);
  assert.equal(result.recommendations.some((item) => item.group === "strong-source"), false);
});

test("surfaces a material positive attribution signal", () => {
  const observations = [
    ...Array.from({ length: 20 }, () => ({ action: "apply_now", decisionScore: 90, outcome: "hired", source: "strong-source", role: "Finance", remote: false })),
    ...Array.from({ length: 20 }, () => ({ action: "apply_now", decisionScore: 70, outcome: "rejected", source: "other-source", role: "Sales", remote: true })),
  ];
  const result = buildAttributionInsights(observations);
  assert.equal(result.recommendations.some((item) => item.group === "strong-source" && item.direction === "positive"), true);
});

test("policy stays inactive below its evidence threshold", () => {
  const result = buildAttributionInsights(Array.from({ length: 29 }, () => ({
    action: "apply_now", decisionScore: 90, outcome: "hired", source: "strong-source", role: "Finance", remote: false,
  })));
  assert.equal(result.policy.eligible, false);
  assert.equal(applyLearningPolicy(80, { source: "strong-source", role: "Finance", remote: false }, result.policy), 80);
});

test("policy adjustment is bounded", () => {
  const observations = [
    ...Array.from({ length: 30 }, () => ({ action: "apply_now", decisionScore: 90, outcome: "hired", source: "strong-source", role: "Finance", remote: false })),
    ...Array.from({ length: 30 }, () => ({ action: "apply_now", decisionScore: 70, outcome: "rejected", source: "other-source", role: "Sales", remote: true })),
  ];
  const result = buildAttributionInsights(observations);
  assert.equal(result.policy.eligible, true);
  assert.equal(applyLearningPolicy(99, { source: "strong-source", role: "Finance", remote: false }, result.policy) <= 100, true);
  assert.equal(applyLearningPolicy(1, { source: "other-source", role: "Sales", remote: true }, result.policy) >= 0, true);
});
