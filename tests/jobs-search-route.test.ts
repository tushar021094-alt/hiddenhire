import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POST,
  buildDiscoveryQueries,
  normalizeCandidateProfile,
} from '../app/api/jobs/search/route.ts';

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
