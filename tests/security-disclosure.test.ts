import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = [
  "../app/api/recruiter/jobs/route.ts",
  "../app/api/applications/route.ts",
  "../app/api/admin/jobs/moderate/route.ts",
  "../app/api/admin/recruiter-verifications/review/route.ts",
  "../app/api/recruiter/verification/route.ts",
];

test("API routes do not return raw database error messages", () => {
  for (const route of routes) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:\b(?:profile|job|application|company|candidateDiscovery|companyLookup|matchSave|verification)Error|\berror)\.message/);
  }
});
