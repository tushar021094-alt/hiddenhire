import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerAgentEffectiveness, buildCareerAgentEffectivenessPolicy } from "@/lib/career-agent-effectiveness";

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


test("keeps action effectiveness policy inactive below the evidence threshold", () => {
  const result = buildCareerAgentEffectiveness(
    Array.from({ length: 29 }, (_, index) => ({
      action: index % 2 ? "review" : "prepare",
      taskStatus: "completed" as const,
      outcome: "applied",
    })),
  );
  const policy = buildCareerAgentEffectivenessPolicy(result);
  assert.equal(policy.eligible, false);
  assert.equal(policy.recommendations.length, 0);
});

test("produces an action recommendation only with sufficient resolved evidence", () => {
  const observations = [
    ...Array.from({ length: 30 }, () => ({ action: "review", taskStatus: "completed" as const, outcome: "interview" })),
    ...Array.from({ length: 30 }, () => ({ action: "prepare", taskStatus: "completed" as const, outcome: "rejected" })),
  ];
  const policy = buildCareerAgentEffectivenessPolicy(buildCareerAgentEffectiveness(observations));
  assert.equal(policy.eligible, true);
  assert.equal(policy.recommendations[0].action, "review");
  assert.equal(policy.recommendations[0].direction, "positive");
});
