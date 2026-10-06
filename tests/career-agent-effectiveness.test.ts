import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerAgentEffectiveness } from "@/lib/career-agent-effectiveness";

test("measures task completion separately from job outcomes", () => {
  const result = buildCareerAgentEffectiveness([
    { action: "review", taskStatus: "completed", outcome: "applied" },
    { action: "review", taskStatus: "dismissed", outcome: "not_started" },
    { action: "prepare", taskStatus: "completed", outcome: "interview" },
  ]);
  assert.equal(result.completed, 2);
  assert.equal(result.dismissed, 1);
  assert.equal(result.completionRate, 67);
  assert.equal(result.actions[0].action, "review");
  assert.equal(result.actions[0].resolvedOutcomes, 1);
  assert.equal(result.actions[1].interviewOrHireRate, 100);
});
