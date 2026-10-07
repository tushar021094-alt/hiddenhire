import test from "node:test";
import assert from "node:assert/strict";
import { estimateInterviewProbability } from "../lib/career-probability";
import type { MatchResult } from "../lib/job-types";

function makeMatch(score: number, missingRequirements: string[] = []): MatchResult {
 return { job: { id: "1", title: "Finance Manager", company: "Example", location: "Noida", country: "India", remote: false, remoteStatus: "FALSE", indiaEligible: true, indiaEligibilityStatus: "YES", salaryMin: 80000, salaryMax: 100000, salaryCurrency: "INR", employmentType: "Full-time", industry: "Finance", requiredSkills: ["Excel"], requiredExperience: 5, description: "Finance role", applicationUrl: "https://example.com", source: "greenhouse", postedDate: "2026-10-08" }, score, opportunityScore: score, roleRelevanceScore: score, applicabilityScore: score, roleClassification: "Finance", financeSubfunction: "CORE_FINANCE", financeSubfunctionScore: score, seniorityCompatibility: "STRONG", matchTier: score >= 85 ? "Strong Match" : "Good Match", reasons: [], missingRequirements, scoreBreakdown: { role: Math.round(score * .4), skills: Math.round(score * .15), experience: Math.round(score * .15), location: Math.round(score * .1), salary: Math.round(score * .1), industry: Math.round(score * .05), seniority: Math.round(score * .05) } };
}

test("probability stays conservative and bounded", () => { const result = estimateInterviewProbability(makeMatch(95)); assert.ok(result.interviewProbability <= 72); assert.ok(result.interviewProbability >= 5); assert.equal(result.confidence, "low"); });
test("stronger fit produces a higher progression estimate", () => { assert.ok(estimateInterviewProbability(makeMatch(90)).interviewProbability > estimateInterviewProbability(makeMatch(65)).interviewProbability); });
test("calibrated evidence changes confidence", () => { const result = estimateInterviewProbability(makeMatch(90), { eligible: true, sampleSize: 60, highScorePositiveRate: 45, overallPositiveRate: 30 }); assert.equal(result.confidence, "high"); assert.equal(result.evidenceLabel, "Calibrated with outcome history"); });
test("missing requirements become explicit friction", () => { const result = estimateInterviewProbability(makeMatch(82, ["SAP", "5+ years experience"])); assert.deepEqual(result.friction.slice(0,2), ["SAP", "5+ years experience"]); });