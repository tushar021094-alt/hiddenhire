import test from "node:test";
import assert from "node:assert/strict";
import { buildAutonomousOpportunityIntelligence, consolidateOpportunitySignals } from "@/lib/autonomous-opportunity-intelligence";

const baseEvent = {
  watch_id: "watch-1",
  job_fingerprint: "acme|finance manager|https://jobs.example.com/1",
  event_type: "new" as const,
  previous_score: null,
  current_score: 91,
  payload: {
    title: "Finance Manager",
    company: "Acme",
    location: "Noida",
    applicationUrl: "https://jobs.example.com/1",
    opportunityScore: 88,
    source: "greenhouse",
  },
  created_at: "2026-10-08T10:00:00Z",
};

test("deduplicates the same opportunity across multiple watches", () => {
  const result = consolidateOpportunitySignals([
    baseEvent,
    { ...baseEvent, watch_id: "watch-2", event_type: "score_increase", previous_score: 86, current_score: 91 },
  ]);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].watchIds.sort(), ["watch-1", "watch-2"]);
  assert.equal(result[0].events.length, 2);
});

test("promotes a fresh high-fit opportunity to act now", () => {
  const result = buildAutonomousOpportunityIntelligence([baseEvent], { now: "2026-10-08T12:00:00Z" });

  assert.equal(result[0].priority, "act_now");
  assert.ok(result[0].attentionScore >= 82);
  assert.ok(result[0].reasons.includes("91% match"));
});

test("active applications change attention without rewriting the match score", () => {
  const result = buildAutonomousOpportunityIntelligence([baseEvent], {
    now: "2026-10-08T12:00:00Z",
    applications: {
      [baseEvent.job_fingerprint]: { status: "interview" },
    },
  });

  assert.equal(result[0].latestScore, 91);
  assert.equal(result[0].priority, "act_now");
  assert.ok(result[0].reasons.includes("interview already active"));
});

test("dismissed opportunities stay suppressed until a material signal appears", () => {
  const result = buildAutonomousOpportunityIntelligence([{
    ...baseEvent,
    current_score: 82,
    event_type: "new",
  }], {
    actions: {
      [baseEvent.job_fingerprint]: { action: "review", taskStatus: "dismissed", outcome: "not_started" },
    },
  });

  assert.equal(result[0].priority, "ignore");
});

test("reopened opportunities can return after dismissal", () => {
  const result = buildAutonomousOpportunityIntelligence([
    { ...baseEvent, event_type: "new", created_at: "2026-10-01T10:00:00Z" },
    { ...baseEvent, event_type: "reopened", created_at: "2026-10-08T10:00:00Z" },
  ], {
    now: "2026-10-08T12:00:00Z",
    actions: {
      [baseEvent.job_fingerprint]: { action: "review", taskStatus: "dismissed", outcome: "not_started" },
    },
  });

  assert.equal(result[0].priority, "act_now");
  assert.ok(result[0].reasons.includes("role reopened"));
});
