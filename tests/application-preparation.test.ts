import test from "node:test";
import assert from "node:assert/strict";
import { buildApplicationPreparation } from "../lib/application-preparation";

test("maps candidate skills to job requirements without inventing achievements", () => {
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

  assert.deepEqual(result.matchedSkills, ["Financial Reporting", "Excel"]);
  assert.deepEqual(result.missingSkills, ["FP&A"]);
  assert.match(result.experienceFit, /meets the listed requirement/);
  assert.match(result.professionalSummary, /Financial Reporting/);
  assert.match(result.coverLetter, /Example Co/);
  assert.equal(result.requirementChecklist.join(" ").includes("invent"), false);
});
