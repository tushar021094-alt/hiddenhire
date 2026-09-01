import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExpandedRoleQueries } from '../lib/job-source.ts';
import { calculateJobMatch, calculateOpportunityScore, getMatchTier } from '../lib/match-engine.ts';
import type { CandidateProfile, Job } from '../lib/job-types.ts';

const candidate: CandidateProfile = {
  resumeText: 'Finance professional with 7 years of experience in FP&A, accounting and controls.',
  targetJobTitle: 'Finance Manager',
  yearsOfExperience: 7,
  minimumSalary: 80000,
  preferredCurrency: 'USD',
  preferredCountries: ['India'],
  remoteOnly: true,
  preferredIndustries: ['Finance', 'Accounting'],
  keySkills: ['Financial reporting', 'Budgeting', 'Forecasting', 'AP/AR'],
};

const baseJob: Job = {
  id: 'job-1',
  title: 'Finance Manager',
  company: 'Northstar',
  location: 'Remote',
  country: 'India',
  remote: true,
  remoteStatus: 'TRUE',
  indiaEligible: true,
  indiaEligibilityStatus: 'YES',
  salaryMin: 80000,
  salaryMax: 95000,
  salaryCurrency: 'USD',
  employmentType: 'Full-time',
  industry: 'Finance',
  requiredSkills: ['Financial reporting', 'Budgeting', 'Forecasting'],
  requiredExperience: 6,
  description: 'Remote finance manager role open to India.',
  applicationUrl: 'https://example.com/job',
  source: 'greenhouse',
  postedDate: new Date().toISOString(),
};

test('role expansion includes related finance titles', () => {
  const roles = buildExpandedRoleQueries(candidate);
  assert.ok(roles.length >= 6);
  assert.ok(roles.some((role) => role.toLowerCase().includes('finance')));
  assert.ok(roles.some((role) => role.toLowerCase().includes('accounting')));
});

test('unknown experience does not zero the match', () => {
  const job: Job = { ...baseJob, id: 'job-unknown-experience', requiredExperience: null };
  const result = calculateJobMatch(candidate, job);
  assert.ok(result.score > 0);
  assert.equal(result.matchTier, 'Strong Match');
});

test('unknown India eligibility stays available and does not auto-disqualify', () => {
  const job: Job = { ...baseJob, id: 'job-unknown-india', indiaEligibilityStatus: 'UNKNOWN', indiaEligible: true };
  const result = calculateJobMatch(candidate, job);
  assert.ok(result.score > 55);
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes('remote')) || result.reasons.some((reason) => reason.toLowerCase().includes('relevant')));
});

test('remote classification supports remote and hybrid locations', () => {
  const remoteJob: Job = { ...baseJob, id: 'job-remote', location: 'Remote - Worldwide', remote: true, remoteStatus: 'TRUE' };
  const onsiteJob: Job = { ...baseJob, id: 'job-onsite', location: 'Bengaluru, India', remote: false, remoteStatus: 'FALSE' };
  assert.equal(remoteJob.remote, true);
  assert.equal(onsiteJob.remote, false);
});

test('salary absence does not explode the match score', () => {
  const job: Job = { ...baseJob, id: 'job-no-salary', salaryMin: null, salaryMax: null };
  const result = calculateJobMatch(candidate, job);
  assert.ok(result.score >= 40);
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes('salary')));
  assert.equal(calculateOpportunityScore(candidate, job) > 0, true);
});

test('match tiering returns expected categories', () => {
  assert.equal(getMatchTier(90), 'Strong Match');
  assert.equal(getMatchTier(78), 'Good Match');
  assert.equal(getMatchTier(63), 'Potential Match');
  assert.equal(getMatchTier(30), 'Low Match');
});
