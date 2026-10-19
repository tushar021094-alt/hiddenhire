import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POST,
  buildDiscoveryQueries,
  normalizeCandidateProfile,
} from '../app/api/jobs/search/route.ts';
import { filterJobsForDiscovery } from '../lib/job-search-service';
import type { Job } from '../lib/job-types';

function mockJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-finance-exec",
    title: "Finance Executive",
    company: "Acme",
    jobFunction: "Finance",
    location: "Delhi, India",
    country: "India",
    remote: false,
    remoteStatus: "FALSE",
    indiaEligible: true,
    indiaEligibilityStatus: "YES",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "INR",
    employmentType: "Full-time",
    industry: "Finance",
    requiredSkills: ["Excel", "Reconciliation"],
    requiredExperience: null,
    description: "Manage monthly reporting, account reconciliation, and finance records.",
    applicationUrl: "https://acme.test/jobs/finance-executive",
    source: "test",
    postedDate: "2026-10-19",
    ...overrides,
  };
}

test('normalizes the candidate profile before demo ranking', async () => {
  const response = await POST(new Request('http://localhost/api/jobs/search', {
    method: 'POST',
    body: JSON.stringify({ demo: true, targetRole: 'Finance Manager' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.dataMode, 'demo');
  assert.ok(payload.count > 0);
});

test('expanded discovery query fields override conflicting request values', () => {
  const profile = {
    targetRole: 'Finance Manager',
    targetJobTitle: 'Finance Manager',
    yearsOfExperience: 1,
    minimumSalary: 1,
    remoteOnly: false,
    country: 'United States',
    industry: 'Other',
    experience: 1,
    indiaOnly: false,
    preferredCountries: ['India'],
    preferredIndustries: ['Finance'],
  };
  const candidate = normalizeCandidateProfile(profile, ['Finance Manager']);
  const [query] = buildDiscoveryQueries(profile, candidate, ['FP&A Manager']);

  assert.deepEqual(query, {
    ...profile,
    targetRole: 'FP&A Manager',
    targetJobTitle: 'FP&A Manager',
    yearsOfExperience: 1,
    minimumSalary: 1,
    remoteOnly: false,
    country: 'India',
    industry: 'Finance',
    experience: 1,
    indiaOnly: true,
  });
});

test('rejects live job search when the candidate is not authenticated', async () => {
  const response = await POST(new Request('http://localhost/api/jobs/search', {
    method: 'POST',
    body: JSON.stringify({ targetRole: 'Finance Manager' }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, 'AUTH_REQUIRED');
});


test("search query filters by all query terms across job details before result limiting", () => {
  const jobs = [
    mockJob({ id: "one", title: "Finance Executive", company: "Acme" }),
    mockJob({ id: "two", title: "Finance Manager", company: "Acme" }),
    mockJob({ id: "three", title: "Accounts Executive", company: "Acme", description: "Finance team reporting and reconciliation." }),
  ];

  assert.deepEqual(
    filterJobsForDiscovery(jobs, "Finance Executive").map((job) => job.id),
    ["one"],
  );
  assert.deepEqual(
    filterJobsForDiscovery(jobs, "finance reconciliation").map((job) => job.id),
    ["one", "two", "three"],
  );
});

test("work-mode filtering distinguishes remote, hybrid, and on-site roles", () => {
  const jobs = [
    mockJob({ id: "remote", remote: true, remoteStatus: "TRUE", location: "Remote - India" }),
    mockJob({ id: "hybrid", remote: false, remoteStatus: "FALSE", location: "Delhi NCR", remotePolicy: "Hybrid, 3 days office" }),
    mockJob({ id: "onsite", remote: false, remoteStatus: "FALSE", location: "Noida", remotePolicy: "On-site" }),
  ];

  assert.deepEqual(filterJobsForDiscovery(jobs, "", "remote").map((job) => job.id), ["remote"]);
  assert.deepEqual(filterJobsForDiscovery(jobs, "", "hybrid").map((job) => job.id), ["hybrid"]);
  assert.deepEqual(filterJobsForDiscovery(jobs, "", "onsite").map((job) => job.id), ["onsite"]);
});
