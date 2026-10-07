import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerOperations } from "@/lib/career-operations";

const NOW = "2026-10-08T12:00:00.000Z";

test("creates urgent interview preparation operations", () => {
  const operations = buildCareerOperations({
    now: NOW,
    applications: [{ id: "a1", status: "interview", created_at: "2026-10-01T12:00:00.000Z", job: { title: "Finance Manager", company: "Acme", application_url: "https://acme.test/apply" } }],
  });
  assert.equal(operations[0]?.kind, "interview_prepare");
  assert.equal(operations[0]?.priority, "urgent");
});

test("creates a follow-up after five days and requires approval", () => {
  const operations = buildCareerOperations({
    now: NOW,
    applications: [{ id: "a2", status: "applied", created_at: "2026-10-02T12:00:00.000Z", job: { title: "FP&A Manager", company: "Beta", application_url: "https://beta.test/apply" } }],
  });
  const operation = operations.find((item) => item.kind === "application_follow_up");
  assert.ok(operation);
  assert.equal(operation?.requiresApproval, true);
});

test("suppresses an opportunity already represented by an open action", () => {
  const operations = buildCareerOperations({
    now: NOW, applications: [],
    actions: [{ id: "x", job_fingerprint: "job-1", action: "review", task_status: "open", source_url: "https://acme.test/apply" }],
    opportunities: [{ jobFingerprint: "job-1", title: "Finance Manager", company: "Acme", applicationUrl: "https://acme.test/apply", priority: "act_now", attentionScore: 90, applicationStatus: null, action: "review", taskStatus: "open" }],
  });
  assert.equal(operations.length, 0);
});

test("adds profile improvement only when readiness is incomplete", () => {
  const operations = buildCareerOperations({ now: NOW, applications: [], profile: { readiness: 80 } });
  assert.equal(operations[0]?.kind, "profile_improvement");
  assert.equal(operations[0]?.route, "/profile");
});
