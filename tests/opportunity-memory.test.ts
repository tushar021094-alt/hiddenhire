import test from "node:test";
import assert from "node:assert/strict";
import { buildOpportunityMemory } from "@/lib/opportunity-memory";

const base = {
  watch_id: "watch-1",
  job_fingerprint: "paytm|finance manager|https://jobs.lever.co/paytm/abc",
  event_type: "new" as const,
  previous_score: null,
  current_score: 78,
  payload: {
    title: "Finance Manager",
    company: "Paytm",
    location: "Noida, India",
    applicationUrl: "https://jobs.lever.co/paytm/abc",
    priority: "strong_match",
  },
  created_at: "2026-10-01T10:00:00Z",
};

test("builds improving opportunity memory from score history", () => {
  const result = buildOpportunityMemory([
    base,
    {
      ...base,
      event_type: "score_increase",
      previous_score: 78,
      current_score: 91,
      created_at: "2026-10-05T10:00:00Z",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].trend, "improving");
  assert.equal(result[0].latestScore, 91);
  assert.equal(result[0].peakScore, 91);
  assert.ok(result[0].whyNow.includes("match improved 78% → 91%"));
});

test("remembers compensation and location changes as why-now signals", () => {
  const result = buildOpportunityMemory([
    base,
    {
      ...base,
      event_type: "salary_change",
      previous_score: 78,
      current_score: 78,
      created_at: "2026-10-03T10:00:00Z",
      payload: { ...base.payload, salaryMin: 1200000, salaryMax: 1800000 },
    },
    {
      ...base,
      event_type: "location_change",
      previous_score: 78,
      current_score: 78,
      created_at: "2026-10-06T10:00:00Z",
      payload: { ...base.payload, location: "Delhi NCR, India" },
    },
  ]);

  assert.equal(result[0].trend, "changed");
  assert.ok(result[0].whyNow.includes("compensation changed"));
  assert.ok(result[0].whyNow.includes("location changed"));
});

test("ranks stronger current opportunities ahead of weaker history", () => {
  const result = buildOpportunityMemory([
    base,
    {
      ...base,
      job_fingerprint: "other|analyst|https://example.com/a",
      current_score: 72,
      payload: { ...base.payload, title: "Finance Analyst", company: "Other", priority: "review" },
      created_at: "2026-10-06T10:00:00Z",
    },
  ]);

  assert.equal(result[0].company, "Paytm");
  assert.ok(result[0].attentionScore > result[1].attentionScore);
});
