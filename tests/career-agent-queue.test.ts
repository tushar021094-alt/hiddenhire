import test from "node:test";
import assert from "node:assert/strict";
import { optimizeCareerQueue } from "../lib/career-agent-queue";

const base = {
  decision_score: 90,
  due_at: null,
  created_at: "2026-10-07T00:00:00.000Z",
  effective_status: "open" as const,
};

test("keeps only the highest-value action per opportunity", () => {
  const items = [
    { ...base, id: "watch", job_fingerprint: "job-1", action: "watch" },
    { ...base, id: "review", job_fingerprint: "job-1", action: "review" },
    { ...base, id: "apply", job_fingerprint: "job-1", action: "apply_now" },
  ];
  const result = optimizeCareerQueue(items, Date.parse("2026-10-07T12:00:00Z"));
  assert.equal(result.length, 1);
  assert.equal(result[0].action, "apply_now");
});

test("prioritizes overdue follow-ups and active interviews", () => {
  const items = [
    { ...base, id: "apply", job_fingerprint: "job-1", action: "apply_now", decision_score: 100 },
    { ...base, id: "follow", job_fingerprint: "job-2", action: "follow_up", due_at: "2026-10-06T00:00:00Z", application_status: "shortlisted" },
    { ...base, id: "prep", job_fingerprint: "job-3", action: "prepare", application_status: "interview" },
  ];
  const result = optimizeCareerQueue(items, Date.parse("2026-10-07T12:00:00Z"));
  assert.equal(result[0].action, "follow_up");
  assert.equal(result[1].action, "prepare");
});

test("caps the daily queue", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ ...base, id: String(i), job_fingerprint: "job-" + i, action: "review" }));
  assert.equal(optimizeCareerQueue(items).length, 12);
});
