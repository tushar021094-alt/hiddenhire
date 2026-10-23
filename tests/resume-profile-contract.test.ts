import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261023123259_add_structured_resume_profile_fields.sql", import.meta.url),
  "utf8",
);
const resumeRoute = readFileSync(
  new URL("../app/api/profile/resume/route.ts", import.meta.url),
  "utf8",
);
const profileRoute = readFileSync(
  new URL("../app/api/profile/route.ts", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../app/profile/page.tsx", import.meta.url),
  "utf8",
);

test("structured resume profile fields are added without dropping existing candidate data", () => {
  for (const column of [
    "education", "work_experience", "certifications", "resume_summary",
    "recommended_target_roles", "suggested_salary_min", "suggested_salary_max",
    "suggested_salary_currency", "salary_recommendation_rationale", "salary_recommendation_confidence",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`, "i"));
  }
});

test("resume extraction returns target-role options and qualified annual salary estimates", () => {
  assert.match(resumeRoute, /recommendedTargetRoles/);
  assert.match(resumeRoute, /minimumAnnual/);
  assert.match(resumeRoute, /maximumAnnual/);
  assert.match(resumeRoute, /not live-market salary data/i);
  assert.match(resumeRoute, /if \(!process\.env\.OPENAI_API_KEY\)/);
});

test("the candidate must explicitly apply and save extracted resume fields", () => {
  assert.match(profilePage, /Apply suggestions & save profile/);
  assert.match(profilePage, /applyResumeDraft/);
  assert.match(profilePage, /fetch\("\/api\/profile"/);
  assert.match(profilePage, /AI estimate only—not a live-market salary survey or guaranteed offer/);
});

test("profile API persists resume details separately from the current target and salary preference", () => {
  assert.match(profileRoute, /careerUpdate\.education = normalizeEducation/);
  assert.match(profileRoute, /careerUpdate\.work_experience = normalizeWorkExperience/);
  assert.match(profileRoute, /careerUpdate\.recommended_target_roles = recommendedTargetRoles/);
  assert.match(profileRoute, /careerUpdate\.suggested_salary_min = suggestedSalaryMin/);
  assert.match(profileRoute, /careerUpdate\.salary_recommendation_confidence = salaryRecommendationConfidence/);
  assert.match(profileRoute, /target_roles:\s*\[role\]/);
});
