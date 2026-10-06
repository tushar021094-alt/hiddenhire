import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

test("location changes keep the same job identity", () => {
  assert.equal(buildJobFingerprint(job), buildJobFingerprint({ ...job, location: "Gurugram, India" }));
});

test("new job event is classified as new", () => {
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


describe("Career Agent watch event ranking", () => {
  it("prioritizes higher event priority before newer lower-priority events", () => {
    const events = [
      { priority: 70, created_at: "2026-10-06T12:00:00Z" },
      { priority: 95, created_at: "2026-10-05T12:00:00Z" },
      { priority: 95, created_at: "2026-10-06T11:00:00Z" },
    ];
    const ranked = [...events].sort((a, b) => {
      const priorityDelta = b.priority - a.priority;
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    assert.deepEqual(ranked.map((event) => event.priority), [95, 95, 70]);
    assert.equal(ranked[0].created_at, "2026-10-06T11:00:00Z");
  });
});
