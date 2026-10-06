import { describe, expect, it } from "vitest";
import { buildApplicationPreparation } from "@/lib/application-preparation";

describe("application preparation", () => {
  it("maps candidate skills to job requirements without inventing achievements", () => {
    const result = buildApplicationPreparation({
      targetRole: "Finance Manager",
      company: "Example Co",
      location: "Noida",
      candidate: {
        headline: "Finance professional",
        experienceYears: 7,
        skills: ["Financial reporting", "Excel", "Forecasting"],
      },
      job: {
        requiredSkills: ["Financial Reporting", "FP&A", "Excel"],
        requiredExperience: 5,
        description: "Own reporting and planning.",
      },
    });

    expect(result.matchedSkills).toEqual(["Financial Reporting", "Excel"]);
    expect(result.missingSkills).toEqual(["FP&A"]);
    expect(result.experienceFit).toContain("meets the listed requirement");
    expect(result.professionalSummary).toContain("Financial Reporting");
    expect(result.coverLetter).toContain("Example Co");
    expect(result.requirementChecklist.join(" ")).not.toContain("invent");
  });
});
