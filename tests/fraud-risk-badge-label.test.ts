import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const badge = readFileSync(
  new URL("../components/fraud-risk-badge.tsx", import.meta.url),
  "utf8",
);
const authenticityBadge = readFileSync(
  new URL("../components/job-authenticity-badge.tsx", import.meta.url),
  "utf8",
);

test("fraud indicator labels the value as a risk score, not a safety score", () => {
  assert.match(badge, /Risk score \{risk\.score\}\/100/);
  assert.match(badge, /higher values mean more detected risk/i);
  assert.doesNotMatch(badge, /Safety \{risk\.score\}\/100/);
});

test("trust labels clarify that authenticity is a heuristic, not a guarantee", () => {
  assert.match(authenticityBadge, /Trust score \{authenticity\.score\}\/100/);
  assert.match(authenticityBadge, /not a probability or a guarantee/i);
  assert.match(authenticityBadge, /recruiter may not be independently verified/i);
});
