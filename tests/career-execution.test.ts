import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerExecutionPackage } from "../lib/career-execution";

const base = {
  candidate: {
    name: "Candidate",
    headline: "Finance professional",
    targetRole: "Finance Manager",
    experienceYears: 7,
    skills: ["Financial reporting", "Excel", "Forecasting"],
    location: "Noida",
  },
  application: {
    id: "app-1",
    status: "applied",
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  job: {
    title: "Finance Manager",
    company: "Acme",
    location: "Noida",
    applicationUrl: "https://acme.test/apply",
  },
};

test("builds an evidence-safe application package", () => {
  const result = buildCareerExecutionPackage(base);
  assert.equal(result.applicationId, "app-1");
  assert.equal(result.mode, "follow_up");
  assert.match(result.professionalSummary, /Finance Manager/);
  assert.match(result.coverLetter, /Acme/);
  assert.match(result.followUpMessage, /Finance Manager/);
  assert.equal(result.approval.required, true);
});

test("switches to interview preparation for active interviews", () => {
  const result = buildCareerExecutionPackage({
    ...base,
    application: { ...base.application, status: "interview" },
  });
  assert.equal(result.mode, "interview");
  assert.equal(result.interviewPlan.stories.length, 4);
  assert.match(result.checklist.join(" "), /interview preparation/i);
});

test("does not invent candidate claims", () => {
  const result = buildCareerExecutionPackage(base);
  assert.match(result.interviewPlan.roleFocus.join(" "), /Do not claim/);
  assert.match(result.approval.submission, /submit the application yourself/);
});
