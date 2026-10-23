import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getDiscoveryViewEmptyMessage,
  getVisibleDiscoveryJobs,
  type DiscoveryView,
} from "../lib/discovery-views";

const jobs = [
  { id: "match", score: 96, remote: false, postedDate: "2026-10-10", salaryMin: null, salaryMax: null, currency: "INR" },
  { id: "recent", score: 81, remote: false, postedDate: "2026-10-22", salaryMin: 900_000, salaryMax: 1_100_000, currency: "INR" },
  { id: "remote-usd", score: 70, remote: true, postedDate: "2026-10-20", salaryMin: 70_000, salaryMax: 90_000, currency: "USD" },
  { id: "remote-inr", score: 72, remote: true, postedDate: "2026-10-18", salaryMin: 1_500_000, salaryMax: 1_800_000, currency: "INR" },
];

test("For You returns all eligible roles ranked by match", () => {
  assert.deepEqual(getVisibleDiscoveryJobs(jobs, "for-you").map((job) => job.id), [
    "match", "recent", "remote-inr", "remote-usd",
  ]);
});

test("Recent returns all eligible roles newest first", () => {
  assert.deepEqual(getVisibleDiscoveryJobs(jobs, "recent").map((job) => job.id), [
    "recent", "remote-usd", "remote-inr", "match",
  ]);
});

test("Remote view contains only remote roles without mutating the supplied results", () => {
  const before = jobs.map((job) => job.id);
  assert.deepEqual(getVisibleDiscoveryJobs(jobs, "remote").map((job) => job.id), [
    "remote-inr", "remote-usd",
  ]);
  assert.deepEqual(jobs.map((job) => job.id), before);
});

test("High Salary excludes undisclosed salary and groups preferred currency before other currencies", () => {
  assert.deepEqual(getVisibleDiscoveryJobs(jobs, "high-salary", "INR").map((job) => job.id), [
    "remote-inr", "recent", "remote-usd",
  ]);
  assert.equal(getVisibleDiscoveryJobs(jobs, "high-salary").some((job) => job.id === "match"), false);
});

test("empty view guidance explains why Remote and High Salary may have no results", () => {
  assert.match(getDiscoveryViewEmptyMessage("remote"), /No remote roles/);
  assert.match(getDiscoveryViewEmptyMessage("high-salary"), /No roles in the current result set disclose salary/);
});

test("the UI uses one exclusive discoveryView state for all four view controls", () => {
  const page = readFileSync(new URL("../app/jobs/page.tsx", import.meta.url), "utf8");
  assert.match(page, /useState<DiscoveryView>\("for-you"\)/);
  assert.match(page, /discoveryView === "for-you".*aria-pressed=\{discoveryView === "for-you"\}/s);
  assert.match(page, /discoveryView === "recent".*aria-pressed=\{discoveryView === "recent"\}/s);
  assert.match(page, /discoveryView === "remote".*aria-pressed=\{discoveryView === "remote"\}/s);
  assert.match(page, /discoveryView === "high-salary".*aria-pressed=\{discoveryView === "high-salary"\}/s);
  assert.match(page, /getVisibleDiscoveryJobs\(\s*jobs,\s*discoveryView/s);
  assert.doesNotMatch(page, /const \[sortMode, setSortMode\]/);
});
