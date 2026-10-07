import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerIntelligence } from "../lib/career-intelligence";
import type { MatchResult } from "../lib/job-types";

function match(score: number, missingRequirements: string[] = []): MatchResult {
  return {
    job: {
      id: String(score), title: "Finance Manager", company: "Example", location: "Noida", country: "India",
      remote: true, remoteStatus: "TRUE", indiaEligible: true, indiaEligibilityStatus: "YES", salaryMin: 60000,
      salaryMax: 90000, salaryCurrency: "INR", employmentType: "Full-time", industry: "Finance",
      requiredSkills: ["Excel", "Forecasting"], requiredExperience: 5, description: "Finance role",
      applicationUrl: "https://example.com", source: "greenhouse", postedDate: "2026-10-07T00:00:00Z",
    },
    score, opportunityScore: score, roleRelevanceScore: score, applicabilityScore: score, roleClassification: "Finance",
    financeSubfunction: "CORE_FINANCE", financeSubfunctionScore: score, seniorityCompatibility: "STRONG",
    matchTier: score >= 85 ? "Strong Match" : score >= 70 ? "Good Match" : score >= 55 ? "Potential Match" : "Low Match",
    reasons: [], missingRequirements, scoreBreakdown: { role: 30, skills: 12, experience: 10, location: 10, salary: 10, industry: 4, seniority: 5 },
  };
}

test("career intelligence improves with strong profile and market evidence", () => {
  const result = buildCareerIntelligence({
    targetRoles: ["Finance Manager"], preferredLocations: ["Noida"], location: "Noida",
    skills: ["Excel", "Forecasting", "Financial Reporting", "Budgeting", "SAP"], yearsOfExperience: 7,
    minimumSalary: 60000, remoteOnly: true, matches: [match(91), match(87), match(82)],
  });
  assert.ok(result.score >= 80);
  assert.equal(result.evidence.topMatch, 91);
  assert.equal(result.evidence.strongMatches, 3);
});

test("career intelligence surfaces profile gaps", () => {
  const result = buildCareerIntelligence({
    targetRoles: [], preferredLocations: [], location: null, skills: [], yearsOfExperience: 0,
    minimumSalary: 0, remoteOnly: false, matches: [match(52, ["SAP", "Power BI"]), match(58, ["SAP", "Power BI"])],
  });
  assert.ok(result.gaps.some((item) => item.includes("target role")));
  assert.ok(result.gaps.some((item) => item.includes("skills")));
  assert.ok(result.gaps.some((item) => item.includes("Repeated opportunity gap: SAP")));
  assert.ok(result.priorityActions.length > 0);
});
