import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");

test("candidate profile form submits all editable fields to the profile API", () => {
  assert.match(page, /fetch\("\/api\/profile",\s*\{[\s\S]*?method:\s*"POST"/);
  for (const field of ["role", "headline", "skills:", "experience:", "country", "remoteOnly", "minSalary:", "salaryCurrency:"]) {
    assert.ok(page.includes(field), `Expected the profile save payload to include ${field}`);
  }
});

test("profile API persists base profile fields and career target/headline for the signed-in candidate", () => {
  assert.match(route, /current\?\.role !== "candidate"/);
  assert.match(route, /from\("profiles"\)\.update\(\{ skills, experience_years: experience, country: country \|\| null, remote_only: remoteOnly, min_salary: minSalary, salary_currency: salaryCurrency \}\)/);
  assert.match(route, /from\("candidate_profiles"\)\.upsert\(/);
  assert.match(route, /target_roles:\s*\[role\]/);
  assert.match(route, /headline:\s*headline \|\| null/);
});

test("profile save keeps success feedback visible and resets loading state on failures", () => {
  assert.match(page, /Career profile saved\. Your latest preferences are now stored\./);
  assert.match(page, /Network error while saving/);
  assert.match(page, /finally\s*\{\s*setSaving\(false\);\s*\}/);
  assert.doesNotMatch(page, /setTimeout\(\(\) => router\.push\("\/dashboard"\), 500\)/);
});
