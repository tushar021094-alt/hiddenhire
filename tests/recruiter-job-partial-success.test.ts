import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../app/api/recruiter/jobs/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/recruiter/page.tsx", import.meta.url), "utf8");
const insertAt = api.indexOf('.from("jobs")');
const postInsert = api.slice(insertAt);

test("candidate discovery failure does not turn an already-created job into a failed request", () => {
  const branchStart = postInsert.indexOf("if (candidateDiscoveryError)");
  const branchEnd = postInsert.indexOf('const { data: company', branchStart);
  assert.ok(branchStart >= 0 && branchEnd > branchStart);
  const discoveryBranch = postInsert.slice(branchStart, branchEnd);
  assert.match(discoveryBranch, /job,[\s\S]*?warning:[\s\S]*?\{ status: 201 \}/);
  assert.doesNotMatch(discoveryBranch, /status: 500/);
});

test("candidate matching errors preserve the created job and return an actionable warning", () => {
  const matchingStart = postInsert.indexOf("try {\n  const candidateMatches");
  const matchingEnd = postInsert.indexOf("\n} catch {\n  return NextResponse.json(", matchingStart);
  assert.ok(matchingStart >= 0 && matchingEnd > matchingStart);
  const matchingBlock = postInsert.slice(matchingStart, matchingEnd);
  assert.match(matchingBlock, /job,[\s\S]*?matches: candidateMatches,[\s\S]*?\{ status: 201 \}/);
  assert.ok(postInsert.includes("The job was saved, but candidate matching could not finish."));
  assert.match(postInsert, /\n\} catch \{[\s\S]*?mode: "native",[\s\S]*?job,[\s\S]*?matches: \[\],[\s\S]*?\{ status: 201 \}/);
});

test("recruiter UI displays partial-success warnings without discarding the job result", () => {
  assert.match(page, /setJob\(d\.job\)/);
  assert.match(page, /setWarning\(typeof d\.warning === "string" \? d\.warning : ""\)/);
  assert.match(page, /role="status"[\s\S]*?\{warning\}/);
});


test("unexpected post-insert errors preserve the persisted job as a partial success", () => {
  const outerCatchStart = postInsert.lastIndexOf("} catch {");
  assert.ok(outerCatchStart >= 0);
  const outerCatch = postInsert.slice(outerCatchStart);
  assert.match(outerCatch, /if \(persistedJob\)/);
  assert.match(outerCatch, /job: persistedJob/);
  assert.match(outerCatch, /warning:[\s\S]*?\{ status: 201 \}/);
});
