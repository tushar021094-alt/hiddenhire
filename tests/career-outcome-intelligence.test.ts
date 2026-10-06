import test from "node:test";
import assert from "node:assert/strict";
import { buildOutcomeIntelligence } from "../lib/career-outcome-intelligence";

test("calculates funnel and evidence breakdowns", () => {
  const result = buildOutcomeIntelligence([
    { action:"apply_now", score:90, outcome:"interview", source:"greenhouse", role:"Finance", remote:false, createdAt:"2026-01-01T00:00:00Z", outcomeAt:"2026-01-04T00:00:00Z" },
    { action:"review", score:70, outcome:"rejected", source:"lever", role:"Sales", remote:true, createdAt:"2026-01-01T00:00:00Z", outcomeAt:"2026-01-02T00:00:00Z" },
  ]);
  assert.equal(result.summary.resolved, 2);
  assert.equal(result.summary.positiveRate, 50);
  assert.equal(result.summary.interviewOrHireRate, 50);
  assert.equal(result.summary.medianOutcomeDays, 3);
  assert.equal(result.breakdowns.find((x) => x.dimension === "score_band")?.results[0].group, "85-100");
});
