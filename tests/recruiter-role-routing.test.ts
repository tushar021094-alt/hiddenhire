import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const recruiterPage = readFileSync(new URL("../app/recruiter/page.tsx", import.meta.url), "utf8");
const talentPage = readFileSync(new URL("../app/recruiter/talent/page.tsx", import.meta.url), "utf8");
const learningPage = readFileSync(new URL("../app/recruiter/learning/page.tsx", import.meta.url), "utf8");

test("job-posting workspace verifies the persisted profile role before showing recruiter tools", () => {
  assert.match(recruiterPage, /\.from\(["']profiles["']\)[\s\S]*?\.select\(["']role["']\)/);
  assert.match(recruiterPage, /profile\.role === "employer" \|\| profile\.role === "agency" \? "allowed" : "blocked"/);
  assert.match(recruiterPage, /Recruiter access is not enabled for this account/);
  assert.match(recruiterPage, /This account is currently saved with the role/);
});

test("Find Talent explains role mismatch instead of silently redirecting candidate accounts", () => {
  assert.match(talentPage, /profile\?\.role === "candidate"/);
  assert.match(talentPage, /Find Talent is restricted to Employer and Agency accounts/);
  assert.doesNotMatch(talentPage, /if \(profile\?\.role !== "employer" && profile\?\.role !== "agency"\) redirect\(["']\/dashboard["']\)/);
});

test("Recruiter Learning explains role mismatch instead of silently redirecting candidate accounts", () => {
  assert.match(learningPage, /profile\?\.role === "candidate"/);
  assert.match(learningPage, /Recruiter learning resources are restricted to Employer and Agency accounts/);
  assert.doesNotMatch(learningPage, /if \(profile\?\.role !== "employer" && profile\?\.role !== "agency"\) redirect\(["']\/dashboard["']\)/);
});

test("role mismatch handling does not automatically modify the stored profile role", () => {
  assert.doesNotMatch(recruiterPage, /from\(["']profiles["']\)\.update\(/);
  assert.doesNotMatch(talentPage, /from\(["']profiles["']\)\.update\(/);
  assert.doesNotMatch(learningPage, /from\(["']profiles["']\)\.update\(/);
});
