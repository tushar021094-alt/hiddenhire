import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerStrategy } from "../lib/career-strategy";

test("career strategy stays gated below 30 resolved outcomes", () => {
  const result = buildCareerStrategy({
    resolved: 29,
    positiveRate: 10,
    interviewOrHireRate: 2,
    rejected: 20,
    attributionRecommendations: [],
  });

  assert.equal(result.eligible, false);
  assert.equal(result.sampleSize, 29);
  assert.equal(result.bottlenecks.length, 0);
});

test("career strategy surfaces conversion bottlenecks with sufficient evidence", () => {
  const result = buildCareerStrategy({
    resolved: 40,
    positiveRate: 35,
    interviewOrHireRate: 5,
    rejected: 25,
    attributionRecommendations: [],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.bottlenecks.length, 3);
  assert.match(result.headline, /Positive outcomes/);
});

test("career strategy recommends only sufficiently evidenced positive segments", () => {
  const result = buildCareerStrategy({
    resolved: 60,
    positiveRate: 55,
    interviewOrHireRate: 15,
    rejected: 10,
    attributionRecommendations: [
      { dimension: "source", group: "Provider A", sampleSize: 29, direction: "positive", delta: 15 },
      { dimension: "role", group: "Finance Manager", sampleSize: 35, direction: "positive", delta: 12 },
    ],
  });

  assert.deepEqual(result.recommendations, [
    "Prioritize Finance Manager role opportunities; historical positive-outcome rate is +12 points versus baseline.",
  ]);
});
