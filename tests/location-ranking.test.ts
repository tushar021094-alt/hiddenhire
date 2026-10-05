import test from 'node:test';
import assert from 'node:assert/strict';
import type { CandidateProfile, Job } from '../lib/job-types';
import { calculateLocationPreferenceScore } from '../lib/match-engine';

const baseCandidate: CandidateProfile = {
  resumeText: '',
  targetJobTitle: 'Finance Manager',
  yearsOfExperience: 6,
  minimumSalary: 65000,
  preferredCurrency: 'INR',
  preferredCountries: ['India'],
  preferredLocations: ['Noida'],
  remoteOnly: false,
  preferredIndustries: [],
  keySkills: [],
};

const job = (overrides: Partial<Job>): Job => ({
  id: 'test',
  title: 'Finance Manager',
  company: 'Test Co',
  location: 'Noida, India',
  country: 'India',
  remote: false,
  remoteStatus: 'FALSE',
  indiaEligible: true,
  indiaEligibilityStatus: 'YES',
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: 'INR',
  employmentType: 'Full-time',
  industry: 'Finance',
  requiredSkills: [],
  requiredExperience: null,
  description: '',
  applicationUrl: 'https://example.com',
  source: 'greenhouse',
  postedDate: new Date().toISOString(),
  ...overrides,
});

test('preferred local on-site roles rank above generic remote roles', () => {
  const local = calculateLocationPreferenceScore(baseCandidate, job({ location: 'Noida, India' }));
  const remote = calculateLocationPreferenceScore(baseCandidate, job({
    location: 'Remote',
    country: 'United States',
    remote: true,
    remoteStatus: 'TRUE',
    indiaEligibilityStatus: 'YES',
  }));

  assert.ok(local > remote);
});

test('India remote roles rank above global remote roles for India-local candidates', () => {
  const indiaRemote = calculateLocationPreferenceScore(baseCandidate, job({
    location: 'Remote - India',
    country: 'India',
    remote: true,
    remoteStatus: 'TRUE',
  }));
  const globalRemote = calculateLocationPreferenceScore(baseCandidate, job({
    location: 'Remote',
    country: 'United States',
    remote: true,
    remoteStatus: 'TRUE',
    indiaEligibilityStatus: 'YES',
  }));

  assert.ok(indiaRemote > globalRemote);
});

test('remote-only candidates still require remote jobs', () => {
  const remoteOnly = { ...baseCandidate, remoteOnly: true };
  assert.equal(calculateLocationPreferenceScore(remoteOnly, job({ remote: false })), 0);
  assert.equal(calculateLocationPreferenceScore(remoteOnly, job({ remote: true, remoteStatus: 'TRUE' })), 100);
});


test("Delhi ranks Noida and Gurugram as local NCR before generic remote roles", () => {
  const profile = {
    ...baseCandidate,
    targetJobTitle: "Finance Manager",
    preferredLocations: ["Delhi"],
    remoteOnly: false,
  };

  const ncr = job({
    title: "Finance Manager",
    location: "Noida, Uttar Pradesh",
    country: "India",
    remote: false,
    remoteStatus: "FALSE",
  });

  const remote = job({
    title: "Finance Manager",
    location: "Remote",
    country: "United States",
    remote: true,
    remoteStatus: "TRUE",
    indiaEligible: true,
    indiaEligibilityStatus: "UNKNOWN",
  });

  assert.ok(calculateLocationPreferenceScore(profile, ncr) > calculateLocationPreferenceScore(profile, remote));
});
