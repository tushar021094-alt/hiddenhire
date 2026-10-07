import test from "node:test";
import assert from "node:assert/strict";
import { buildProactiveCareerPlan } from "../lib/proactive-career-agent";
import type { MatchResult } from "../lib/job-types";

function match(score: number, title = "Finance Manager"): MatchResult {
  return { job: { id: String(score), title, company: "Example Corp", location: "Noida", country: "India", remote: false, remoteStatus: "FALSE", indiaEligible: true, indiaEligibilityStatus: "YES", salaryMin: 60000, salaryMax: 90000, salaryCurrency: "INR", employmentType: "Full-time", industry: "Finance", requiredSkills: ["Excel"], requiredExperience: 5, description: "Finance role", applicationUrl: "https://example.com/" + score, source: "seed", postedDate: "2026-10-08" }, score, opportunityScore: score, roleRelevanceScore: score, applicabilityScore: score, roleClassification: "Finance", financeSubfunction: "CORE_FINANCE", financeSubfunctionScore: score, seniorityCompatibility: "STRONG", matchTier: score >= 85 ? "Strong Match" : score >= 75 ? "Good Match" : "Potential Match", reasons: [], missingRequirements: [], scoreBreakdown: { role: 30, skills: 12, experience: 10, location: 10, salary: 10, industry: 4, seniority: 5 } };
}

test("proactive plan selects a high-confidence application as the primary move", () => { const plan = buildProactiveCareerPlan([match(91), match(79)]); assert.equal(plan.primary?.action, "apply_now"); assert.equal(plan.primary?.score, 91); assert.equal(plan.scanState, "actionable"); });
test("proactive plan promotes stale active applications to follow-up", () => { const now = Date.parse("2026-10-08T12:00:00Z"); const plan = buildProactiveCareerPlan([match(82)], [{ status: "applied", created_at: "2026-10-01T12:00:00Z" }], now); assert.equal(plan.primary?.action, "follow_up"); assert.match(plan.primary?.whyNow ?? "", /7 days/); });
test("proactive plan falls back to monitoring when all fits are modest", () => { const plan = buildProactiveCareerPlan([match(63), match(68)]); assert.equal(plan.scanState, "monitoring"); assert.equal(plan.primary?.action, "watch"); });