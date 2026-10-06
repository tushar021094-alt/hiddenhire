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
