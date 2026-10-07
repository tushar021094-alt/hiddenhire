import { describe, expect, it } from "vitest";
import type { CandidateProfile, Job, MatchResult } from "@/lib/job-types";
import { applyCareerSimulationChanges, buildCareerSimulation } from "@/lib/career-simulation";

const profile: CandidateProfile = {
  resumeText: "", targetJobTitle: "Finance Manager", yearsOfExperience: 7, minimumSalary: 1000000,
  preferredCurrency: "INR", preferredCountries: ["India"], preferredLocations: ["Noida"], remoteOnly: false,
  preferredIndustries: ["Finance"], keySkills: ["Excel"],
};

function job(id: string, title: string): Job {
  return {
    id, title, company: "Acme", location: "Noida", country: "India", remote: false, remoteStatus: "FALSE",
    indiaEligible: true, indiaEligibilityStatus: "YES", salaryMin: 900000, salaryMax: 1500000, salaryCurrency: "INR",
    employmentType: "Full-time", industry: "Finance", requiredSkills: ["Excel"], requiredExperience: 5, description: "",
    applicationUrl: "https://example.com/" + id, source: "Greenhouse", postedDate: new Date().toISOString(),
  };
}
function match(j: Job, score: number): MatchResult {
  return {
    job: j, score, opportunityScore: 80, roleRelevanceScore: score, applicabilityScore: score, roleClassification: "Finance",
    financeSubfunction: "CORE_FINANCE", financeSubfunctionScore: 80, seniorityCompatibility: "STRONG",
    matchTier: score >= 85 ? "Strong Match" : score >= 70 ? "Good Match" : "Potential Match",
    reasons: [], missingRequirements: [], scoreBreakdown: { role: Math.round(score * .4), skills: 15, experience: 15, location: 10, salary: 10, industry: 5, seniority: 5 },
  };
}

describe("career simulation", () => {
  it("does not mutate the saved profile", () => {
    const simulated = applyCareerSimulationChanges(profile, { addSkills: ["SAP"], addLocations: ["Delhi"], minimumSalary: 800000, remoteOnly: true });
    expect(profile.keySkills).toEqual(["Excel"]);
    expect(profile.preferredLocations).toEqual(["Noida"]);
    expect(profile.minimumSalary).toBe(1000000);
    expect(profile.remoteOnly).toBe(false);
    expect(simulated.keySkills).toEqual(["Excel", "SAP"]);
    expect(simulated.preferredLocations).toEqual(["Noida", "Delhi"]);
    expect(simulated.minimumSalary).toBe(800000);
    expect(simulated.remoteOnly).toBe(true);
  });
  it("deduplicates hypothetical skills and locations", () => {
    const simulated = applyCareerSimulationChanges(profile, { addSkills: ["excel", "SAP", " SAP "], addLocations: ["Noida", "Delhi"] });
    expect(simulated.keySkills).toEqual(["Excel", "SAP"]);
    expect(simulated.preferredLocations).toEqual(["Noida", "Delhi"]);
  });
  it("reports newly unlocked and improved opportunities", () => {
    const a = job("a", "Finance Manager"); const b = job("b", "FP&A Manager");
    const result = buildCareerSimulation([match(a, 50)], [match(a, 70), match(b, 88)]);
    expect(result.deltas.strongMatches).toBe(1);
    expect(result.newlyUnlocked.map((item) => item.job.id)).toContain("b");
    expect(result.improved.map((item) => item.job.id)).toContain("a");
  });
  it("reports regressions deterministically", () => {
    const a = job("a", "Finance Manager");
    const result = buildCareerSimulation([match(a, 85)], [match(a, 78)]);
    expect(result.deltas.strongMatches).toBe(-1);
    expect(result.regressed[0].scoreDelta).toBe(-7);
    expect(result.summary).toContain("reduces");
  });
});
