import { describe, expect, it } from "vitest";
import type { MatchResult } from "@/lib/job-types";
import { buildCareerSimulation } from "@/lib/career-simulation";
import { generateCareerStrategyCandidates, rankCareerStrategies } from "@/lib/career-strategy-optimizer";

function match(id: string, score: number, missingRequirements: string[], location = "Delhi") {
  return {
    job: { id, title: "Finance Manager", company: "Acme", location },
    score,
    opportunityScore: 80,
    roleRelevanceScore: score,
    missingRequirements,
    scoreBreakdown: { role: 30, skills: 10, experience: 15, location: 10, salary: 10, industry: 5, seniority: 5 },
  } as MatchResult;
}

describe("career strategy optimizer", () => {
  it("generates only evidence-backed strategy candidates", () => {
    const candidates = generateCareerStrategyCandidates(
      [match("1", 88, ["SAP"], "Gurgaon"), match("2", 82, ["FP&A"], "Delhi")],
      1000000,
      false,
    );
    expect(candidates.map((candidate) => candidate.id)).toEqual(["skills", "locations", "salary", "remote"]);
    expect(candidates[0].changes.addSkills).toEqual(["SAP", "FP&A"]);
    expect(candidates[1].changes.addLocations).toEqual(["Gurgaon", "Delhi"]);
    expect(candidates[2].changes.minimumSalary).toBe(900000);
  });

  it("does not create redundant remote or salary strategies", () => {
    const candidates = generateCareerStrategyCandidates([match("1", 80, [], "Remote")], 0, true);
    expect(candidates.some((candidate) => candidate.id === "remote")).toBe(false);
    expect(candidates.some((candidate) => candidate.id === "salary")).toBe(false);
  });

  it("ranks the strategy with the strongest interview-probability lift first", () => {
    const baseline = match("1", 70, []);
    const first = buildCareerSimulation([baseline], [match("1", 75, [])]);
    const second = buildCareerSimulation([baseline], [match("1", 90, [])]);
    const ranked = rankCareerStrategies([
      { ...generateCareerStrategyCandidates([baseline], 1000000, false)[0], simulation: first },
      { ...generateCareerStrategyCandidates([baseline], 1000000, false)[0], id: "second", label: "Second", simulation: second },
    ]);
    expect(ranked[0].id).toBe("second");
    expect(ranked[0].rank).toBe(1);
  });
});
