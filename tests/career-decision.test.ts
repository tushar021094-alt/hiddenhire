import test from "node:test";
import assert from "node:assert/strict";
import { decideOpportunityAction } from "@/lib/career-decision";
import type { OpportunityMemory } from "@/lib/opportunity-memory";

const opportunity: OpportunityMemory = {
  jobFingerprint: "x",
  title: "Finance Manager",
  company: "Paytm",
  location: "Noida",
  applicationUrl: "https://example.com/job",
  latestScore: 91,
  peakScore: 91,
  firstSeenAt: "2026-10-01T00:00:00Z",
  lastChangedAt: "2026-10-06T00:00:00Z",
  eventCount: 2,
  eventTypes: ["new", "score_increase"],
  trend: "improving",
  attentionScore: 94,
  whyNow: ["91% match", "match improved 78% → 91%"],
};

test("high improving match becomes apply now", () => {
  assert.equal(decideOpportunityAction(opportunity).action, "apply_now");
});

test("already applied opportunity becomes follow up", () => {
  assert.equal(decideOpportunityAction(opportunity, { alreadyApplied: true }).action, "follow_up");
});

test("active interview takes priority over application action", () => {
  assert.equal(decideOpportunityAction(opportunity, { hasInterview: true }).action, "prepare");
});

test("moderate match becomes watch", () => {
  assert.equal(decideOpportunityAction({ ...opportunity, latestScore: 68, trend: "stable" }).action, "watch");
});
