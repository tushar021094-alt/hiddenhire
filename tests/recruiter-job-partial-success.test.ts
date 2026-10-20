import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../app/api/recruiter/jobs/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/recruiter/page.tsx", import.meta.url), "utf8");
const insertAt = api.indexOf('.from("jobs")');
const postInsert = api.slice(insertAt);

test("candidate discovery failure does not turn an already-created job into a failed request", () => {
  assert.match(postInsert, /candidateDiscoveryError[\s\S]*?job,[\s\S]*?warning:[\s\S]*?\{ status: 201 \}/);
  assert.doesNotMatch(postInsert, /if \(candidateDiscoveryError\)[\s\S]*?\{ status: 500 \}/);
});

test("candidate matching errors preserve the created job and return an actionable warning", () => {
  assert.match(postInsert, /catch \{[\s\S]*?mode: "native",[\s\S]*?job,[\s\S]*?matches: \[\],[\s\S]*?warning:[\s\S]*?\{ status: 201 \}/);
  assert.match(postInsert, /Job was saved, but candidate matching could not finish/);
});

test("recruiter UI displays partial-success warnings without discarding the job result", () => {
  assert.match(page, /setJob\(d\.job\)/);
  assert.match(page, /setWarning\(typeof d\.warning === "string" \? d\.warning : ""\)/);
  assert.match(page, /role="status"[\s\S]*?\{warning\}/);
});
