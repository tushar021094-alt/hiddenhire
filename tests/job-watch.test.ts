import test from "node:test";
import assert from "node:assert/strict";
import { buildJobFingerprint, classifyWatchEvent, eventPriority } from "@/lib/job-watch";

const job = {
  title: "Finance Manager",
  company: "Paytm",
  location: "Noida, India",
  salaryMin: 1200000,
  salaryMax: 1800000,
  applicationUrl: "https://jobs.lever.co/paytm/abc?source=hiddenhire",
};

test("job fingerprint is stable across tracking parameters", () => {
  assert.equal(
    buildJobFingerprint(job),
    buildJobFingerprint({ ...job, applicationUrl: "https://jobs.lever.co/paytm/abc?source=other#apply" }),
  );
});

test("location changes keep the same job identity", () => {\n  assert.equal(buildJobFingerprint(job), buildJobFingerprint({ ...job, location: "Gurugram, India" }));\n});\n\ntest("new job event is classified as new", () => {
  assert.equal(classifyWatchEvent(null, { score: 88, job }), "new");
});

test("meaningful score improvement is classified before salary changes", () => {
  assert.equal(
    classifyWatchEvent({ score: 70, salaryMin: 1000000, salaryMax: 1500000, location: job.location }, { score: 80, job }),
    "score_increase",
  );
});

test("salary change is detected when score is stable", () => {
  assert.equal(
    classifyWatchEvent({ score: 75, salaryMin: 900000, salaryMax: 1200000, location: job.location }, { score: 75, job }),
    "salary_change",
  );
});

test("location change is detected after score and salary stay stable", () => {
  assert.equal(
    classifyWatchEvent({ score: 75, salaryMin: job.salaryMin, salaryMax: job.salaryMax, location: "Gurugram, India" }, { score: 75, job }),
    "location_change",
  );
});

test("priority tiers favor high-confidence new opportunities", () => {
  assert.equal(eventPriority("new", 90), "apply_now");
  assert.equal(eventPriority("score_increase", 80), "strong_match");
  assert.equal(eventPriority("location_change", 70), "review");
});
