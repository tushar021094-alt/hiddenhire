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
  assert.match(route, /const profileUpdate: JsonRecord = \{/);
  assert.match(route, /profileUpdate\.full_name = fullName/);
  assert.match(route, /from\("profiles"\)\.update\(profileUpdate\)/);
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

test("new profiles do not inherit an unrelated Finance Manager title or invented FP&A skills", () => {
  assert.match(page, /const \[role, setRole\] = useState\(""\)/);
  assert.match(page, /setRole\(data\.career\?\.target_roles\?\.\[0\] \|\| ""\)/);
  assert.match(page, /placeholder="e\.g\., Finance Executive"/);
  assert.match(page, /const \[skills, setSkills\] = useState\(""\)/);
  assert.match(page, /const \[experience, setExperience\] = useState\(""\)/);
});

test("profile warns when the target role conflicts with the professional headline", () => {
  assert.match(page, /Your target role and headline point to different roles/);
  assert.match(page, /Job Discovery uses <strong>Target role<\/strong> for ranking/);
});

test("country is selected from a global dropdown and locations are multi-select chips", () => {
  assert.match(page, /COUNTRY_OPTIONS\.map/);
  assert.match(page, /aria-label="Primary country"/);
  assert.doesNotMatch(page, /<Field label="Country"[^]*?<input value=\{country\}/);
  assert.match(page, /label="Preferred locations"/);
  assert.match(page, /setPreferredLocations\(loadedPreferredLocations\)/);
  assert.match(page, /function addPreferredLocation/);
  assert.match(page, /function removePreferredLocation/);
  assert.match(page, /profile-location-selected-list/);
  assert.match(page, /LOCATION_SUGGESTIONS\[country\]/);
  assert.ok(page.includes("preferredLocations,"));
  assert.match(route, /function normalizePreferredLocations/);
  assert.match(route, /!isCountryName\(location\)/);
  assert.match(route, /careerUpdate\.preferred_locations = normalizePreferredLocations\(input\.preferredLocations\)/);
  assert.doesNotMatch(route, /preferred_locations:\s*country\s*\?\s*\[country\]/);
});
