import { describe, expect, it } from "vitest";
import { buildRecruiterCandidateIntelligence } from "@/lib/recruiter-intelligence";

const match = {
  score: 92, opportunityScore: 90, roleRelevanceScore: 94, applicabilityScore: 90,
  roleClassification: "Finance", financeSubfunction: null, financeSubfunctionScore: 0,
  seniorityCompatibility: "strong", matchTier: "Excellent", reasons: ["Strong role alignment"],
  missingRequirements: [], scoreBreakdown: { role: 95, skills: 90, experience: 90, location: 90, salary: 90, industry: 80, seniority: 90 },
  job: { source: "HiddenHire", jobFunction: "Finance", remote: true, title: "Finance Manager" },
} as unknown as Parameters<typeof buildRecruiterCandidateIntelligence>[0]["match"];

describe("recruiter intelligence", () => {
  it("elevates strong fit with complete profile signal", () => {
    const result = buildRecruiterCandidateIntelligence({ match, candidate: { skills: ["FP&A","Excel","Forecasting"], experienceYears: 7, headline: "Finance Manager", targetRoles: ["Finance Manager"] }});
    expect(result.priority).toBe("strong");
    expect(result.nextAction).toBe("shortlist");
  });
  it("keeps weak profile signal conservative", () => {
    const result = buildRecruiterCandidateIntelligence({ match, candidate: { skills: ["Excel"], experienceYears: 0, headline: null, targetRoles: [] }});
    expect(result.readinessScore).toBeLessThan(75);
  });
});
