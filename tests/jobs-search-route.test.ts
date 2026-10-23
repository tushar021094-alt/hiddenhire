import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  POST,
  buildDiscoveryQueries,
  normalizeCandidateProfile,
} from '../app/api/jobs/search/route.ts';
import { filterJobsForDiscovery } from '../lib/job-search-service';
import { buildCandidateSearchIntent, isJobEligible } from '../lib/search-policy';
import { calculateJobMatch } from '../lib/match-engine';
import type { CandidateProfile, Job } from '../lib/job-types';

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

test("empty title searches automatically fall back to saved-profile recommendations", () => {
  const jobsPage = readFileSync(new URL("../app/jobs/page.tsx", import.meta.url), "utf8");
  assert.match(jobsPage, /payload\?\.results\.length === 0/);
  assert.match(jobsPage, /searchQuery: ""/);
  assert.match(jobsPage, /personalized recommendations based on your saved profile/);
});

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


test("finance role-title searches include adjacent roles instead of requiring every title word", () => {
  const jobs = [
    mockJob({ id: "one", title: "Finance Executive", company: "Acme" }),
    mockJob({ id: "two", title: "Finance Manager", company: "Acme" }),
    mockJob({ id: "three", title: "Accounts Specialist", company: "Acme", description: "Finance team reporting and reconciliation." }),
  ];

  assert.deepEqual(
    filterJobsForDiscovery(jobs, "Finance Executive").map((job) => job.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    filterJobsForDiscovery(jobs, "finance reconciliation").map((job) => job.id),
    ["one", "two"],
  );
});

test("multi-word role searches do not match unrelated roles through description text alone", () => {
  const jobs = [
    mockJob({ id: "finance-exec", title: "Finance Executive" }),
    mockJob({
      id: "stripe-account-exec",
      title: "Account Executive, Product - Issuing & Treasury",
      company: "Stripe",
      jobFunction: "Sales",
      requiredSkills: ["Product Sales", "MaaS"],
      description: "Help businesses use financial products and manage finance workflows.",
    }),
    mockJob({
      id: "finance-head",
      title: "Head of Finance Business Partnering, Operations & Technology",
      company: "Tide",
      jobFunction: "Finance",
      requiredSkills: ["Enablement", "GL"],
      description: "Partner with executive leadership on finance operations.",
    }),
  ];

  assert.deepEqual(
    filterJobsForDiscovery(jobs, "Finance Executive").map((job) => job.id),
    ["finance-exec", "finance-head"],
  );

  // A finance-intent query must not turn a Sales listing into a finance result
  // merely because "financial" appears in its description.
  assert.deepEqual(
    filterJobsForDiscovery(jobs, "financial").map((job) => job.id),
    [],
  );

  // Generic single-term discovery may still match genuine description wording.
  assert.deepEqual(
    filterJobsForDiscovery(jobs, "workflows").map((job) => job.id),
    ["stripe-account-exec"],
  );
});

test("finance executive searches include billing and MIS roles but exclude sales roles", () => {
  const jobs = [
    mockJob({ id: "exact", title: "Finance Executive" }),
    mockJob({
      id: "billing",
      title: "E-Billing Operations Analyst",
      jobFunction: "Operations",
      requiredSkills: ["Invoice Processing", "Excel"],
    }),
    mockJob({
      id: "mis",
      title: "MIS Reporting Executive",
      jobFunction: "Other",
      requiredSkills: ["MIS Reporting", "Excel"],
    }),
    mockJob({
      id: "sales",
      title: "Account Executive, Treasury Solutions",
      company: "Example Sales",
      jobFunction: "Sales",
      requiredSkills: ["Sales", "CRM"],
      description: "Sell financial products and treasury technology to customers.",
    }),
  ];

  assert.deepEqual(
    filterJobsForDiscovery(jobs, "Finance Executive jobs").map((job) => job.id),
    ["exact", "billing", "mis"],
  );
});

test("salary thresholds are not compared across different currencies", () => {
  const candidate: CandidateProfile = {
    resumeText: "",
    targetJobTitle: "Finance Manager",
    yearsOfExperience: 11,
    minimumSalary: 1_200_000,
    preferredCurrency: "INR",
    preferredCountries: ["India"],
    preferredLocations: [],
    remoteOnly: false,
    preferredIndustries: [],
    keySkills: ["SAP Billing", "Invoice Processing", "MIS Reporting"],
  };
  const usdJob = mockJob({
    title: "Finance Executive",
    location: "Remote",
    country: "United States",
    remote: true,
    remoteStatus: "TRUE",
    indiaEligibilityStatus: "UNKNOWN",
    salaryMin: 70_000,
    salaryMax: 90_000,
    salaryCurrency: "USD",
  });
  const inrJob = mockJob({
    ...usdJob,
    salaryMin: 70_000,
    salaryMax: 90_000,
    salaryCurrency: "INR",
  });
  const intent = buildCandidateSearchIntent({
    ...candidate,
    targetRoles: ["Finance Manager"],
    preferredLocations: [],
    country: "India",
  });

  assert.equal(isJobEligible(intent, usdJob), true);
  assert.ok(
    calculateJobMatch(candidate, usdJob).scoreBreakdown.salary <
      calculateJobMatch(candidate, inrJob).scoreBreakdown.salary,
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

test("multi-word role search does not use free-text descriptions to complete a title match", () => {
  const jobs = [
    mockJob({
      id: "finance-head",
      title: "Head of Finance Business Partnering, Operations & Technology",
      company: "Tide",
      jobFunction: "Finance",
      requiredSkills: ["Enablement", "GL"],
      description: "Partner with executive leadership on finance operations.",
    }),
    mockJob({
      id: "finance-executive",
      title: "Finance Executive",
      company: "Acme",
      jobFunction: "Finance",
      requiredSkills: ["Excel", "Reconciliation"],
      description: "Support monthly close and account reconciliations.",
    }),
  ];

  assert.deepEqual(
    filterJobsForDiscovery(jobs, "Finance Executive").map((job) => job.id),
    ["finance-head", "finance-executive"],
  );
});
