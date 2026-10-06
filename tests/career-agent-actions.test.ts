import test from "node:test";
import assert from "node:assert/strict";
import { decideOpportunityAction } from "@/lib/career-decision";
import type { OpportunityMemory } from "@/lib/opportunity-memory";

const base: OpportunityMemory = {
  jobFingerprint: "job-1", title: "Finance Manager", company: "Example Co",
  location: "Noida", applicationUrl: "https://example.com/job",
  latestScore: 92, peakScore: 92, firstSeenAt: "2026-10-01T00:00:00Z",
  lastChangedAt: "2026-10-06T00:00:00Z", eventCount: 2,
  eventTypes: ["new", "score_increase"], trend: "improving",
  attentionScore: 95, whyNow: ["92% match"],
};

test("action layer exposes safe next actions", () => {
  assert.equal(decideOpportunityAction(base).action, "apply_now");
  assert.equal(decideOpportunityAction(base, { alreadyApplied: true }).action, "follow_up");
  assert.equal(decideOpportunityAction(base, { application: { status: "interview" } }).action, "prepare");
  assert.equal(decideOpportunityAction({ ...base, latestScore: 68, trend: "stable" }).action, "watch");
});
