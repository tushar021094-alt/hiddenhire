import test from "node:test";
import assert from "node:assert/strict";

import { deduplicateJobs } from "../app/api/jobs/search/route.ts";

test("deduplicateJobs removes canonical URL duplicates", () => {
  const jobs = [
    { company: "Coinbase", title: "Accounting Manager", location: "Remote", applicationUrl: "https://jobs.example.com/abc?utm_source=one" },
    { company: "Coinbase", title: "Accounting Manager", location: "Remote", applicationUrl: "https://jobs.example.com/abc/?utm_source=two" },
    { company: "Paytm", title: "Business Finance Manager", location: "Noida", applicationUrl: "https://jobs.example.com/paytm-1" },
  ];

  assert.equal(deduplicateJobs(jobs).length, 2);
});

test("deduplicateJobs preserves distinct roles with different locations", () => {
  const jobs = [
    { company: "Example", title: "Finance Manager", location: "Delhi", applicationUrl: "https://jobs.example.com/delhi" },
    { company: "Example", title: "Finance Manager", location: "Mumbai", applicationUrl: "https://jobs.example.com/mumbai" },
  ];

  assert.equal(deduplicateJobs(jobs).length, 2);
});
