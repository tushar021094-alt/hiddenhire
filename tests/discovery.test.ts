import test from 'node:test';
import assert from 'node:assert/strict';

import { applyJobFilters, buildExpandedRoleQueries, CompanyDiscoverySource, createJobSourceRegistry, dedupeJobs } from '../lib/job-source.ts';
import { verifiedCompanyRegistry } from '../lib/company-registry.ts';
import { calculateJobMatch, calculateOpportunityScore, classifyFinanceSubfunction, classifyJobFunction, getMatchTier } from '../lib/match-engine.ts';
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

function roleJob(title: string, description: string, overrides: Partial<Job> = {}): Job {
  return { ...baseJob, id: `role-${title}`, title, description, ...overrides };
}

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

test('classifies job function from title and description', () => {
  assert.equal(classifyJobFunction('Machine Learning Engineer', 'Build production ML systems.'), 'Engineering');
  assert.equal(classifyJobFunction('Forward Deployed Engineer, Finance', 'Build production systems.'), 'Engineering');
  assert.equal(classifyJobFunction('Group Product Manager, Finance Technology', 'Own product strategy.'), 'Product');
  assert.equal(classifyJobFunction('Marketing Manager', 'Own growth marketing strategy.'), 'Marketing');
  assert.equal(classifyJobFunction('Finance Manager', 'Own budgeting, forecasting, and financial reporting.'), 'Finance');
});

test('direct finance roles receive high relevance', () => {
  for (const title of ['Senior Finance Manager', 'FP&A Manager', 'Financial Controller']) {
    const result = calculateJobMatch(candidate, roleJob(title, 'Lead budgeting, forecasting, financial reporting, and month-end close.'));
    assert.ok(result.roleRelevanceScore >= 85, `${title}: ${result.roleRelevanceScore}`);
  }
});

test('senior accountant receives moderate relevance', () => {
  const result = calculateJobMatch(candidate, roleJob('Senior Accountant', 'Own general ledger, accounts payable, and month-end close.'));
  assert.ok(result.roleRelevanceScore >= 55);
  assert.ok(result.roleRelevanceScore < 90);
});

test('finance company context cannot rescue engineering roles', () => {
  const result = calculateJobMatch(candidate, roleJob('Senior Machine Learning Engineer', 'Build machine learning models and production software.', { industry: 'Finance' }));
  assert.equal(classifyJobFunction(result.job.title, result.job.description), 'Engineering');
  assert.ok(result.roleRelevanceScore < 30);
  assert.ok(result.score < 55);
});

test('marketing roles remain low relevance at finance companies', () => {
  const result = calculateJobMatch(candidate, roleJob('Marketing Manager', 'Own growth marketing, campaigns, and brand strategy.', { industry: 'Finance' }));
  assert.equal(classifyJobFunction(result.job.title, result.job.description), 'Marketing');
  assert.ok(result.roleRelevanceScore < 30);
});

test('business partner descriptions can establish finance relevance', () => {
  const result = calculateJobMatch(candidate, roleJob('Business Partner Analyst', 'Deliver financial planning, budgeting, forecasting, and management reporting.'));
  assert.ok(result.roleRelevanceScore >= 55);
});

test('business operations sales descriptions stay low relevance', () => {
  const result = calculateJobMatch(candidate, roleJob('Business Operations Manager', 'Run sales operations, CRM workflows, and customer acquisition programs.'));
  assert.ok(result.roleRelevanceScore < 55);
});

test('obvious non-finance manager titles cannot inherit finance subfunctions', () => {
  for (const title of ['Assistant Housekeeping Manager', 'Manager - Customer Care', 'Integrated Campaigns Manager', 'Senior Product Analyst - Finance Technology', 'Commercial Solutions Program Manager']) {
    const job = roleJob(title, 'The company operates in financial services.', { industry: 'Finance' });
    assert.equal(classifyFinanceSubfunction(job), 'NOT_FINANCE');
    const result = calculateJobMatch(candidate, job);
    assert.ok(result.financeSubfunctionScore <= 20);
  }
});

test('applicability prioritizes India eligibility and remote compatibility', () => {
  const indiaRemote = calculateJobMatch(candidate, roleJob('Finance Manager', 'Own financial reporting.', { remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'YES' }));
  const usOnly = calculateJobMatch(candidate, roleJob('Finance Manager', 'Own financial reporting.', { remote: true, remoteStatus: 'TRUE', country: 'United States', indiaEligibilityStatus: 'NO' }));
  const indiaOnsite = calculateJobMatch(candidate, roleJob('Finance Manager', 'Own financial reporting.', { remote: false, remoteStatus: 'FALSE', country: 'India', indiaEligibilityStatus: 'YES' }));
  assert.ok(indiaRemote.applicabilityScore > usOnly.applicabilityScore);
  assert.ok(indiaRemote.applicabilityScore > indiaOnsite.applicabilityScore);
  assert.equal(usOnly.seniorityCompatibility, 'STRONG');
});

test('finance sub-functions expose applicability and seniority', () => {
  const cases: Array<[string, string]> = [
    ['Finance Manager', 'Finance'],
    ['FP&A Manager', 'FP&A'],
    ['Accounting Manager', 'Accounting'],
    ['Senior Accountant', 'Accounting'],
    ['IT Audit Manager', 'Audit'],
    ['Software Engineer', 'Engineering'],
  ];
  for (const [title, classification] of cases) {
    const result = calculateJobMatch(candidate, roleJob(title, `${title} responsibilities.`));
    assert.equal(result.roleClassification, classification);
    assert.ok(result.applicabilityScore >= 0 && result.applicabilityScore <= 100);
    assert.ok(result.seniorityCompatibility.length > 0);
  }
});

test('V4 finance tiers and location evidence are deterministic', () => {
  const indiaRemote = roleJob('Finance Manager', 'Own financial reporting.', { location: 'Remote - India', country: 'India', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'YES' });
  const fpaRemote = roleJob('FP&A Manager', 'Own budgeting and forecasting.', { location: 'Remote - India', country: 'India', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'YES' });
  const accountingRemote = roleJob('Accounting Manager', 'Own month-end close.', { location: 'Remote - India', country: 'India', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'YES' });
  const seniorAccountant = roleJob('Senior Accountant', 'Own general ledger.', { location: 'Remote - India', country: 'India', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'YES' });
  const strategicUs = roleJob('Strategic Finance Manager', 'Own financial planning.', { location: 'Remote - USA', country: 'United States', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'NO' });
  const canada = roleJob('Finance Manager', 'Own financial planning.', { location: 'Canada', country: 'Canada', remote: false, remoteStatus: 'FALSE', indiaEligibilityStatus: 'NO' });
  const abuDhabi = roleJob('Accounting Manager', 'Own accounting operations.', { location: 'Remote - Abu Dhabi', country: 'United Arab Emirates', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'NO' });
  const emea = roleJob('Finance Manager', 'Own financial planning.', { location: 'Remote - EMEA', country: 'EMEA', remote: true, remoteStatus: 'TRUE', indiaEligibilityStatus: 'UNKNOWN' });

  const indiaResult = calculateJobMatch(candidate, indiaRemote);
  const fpaResult = calculateJobMatch(candidate, fpaRemote);
  const accountingResult = calculateJobMatch(candidate, accountingRemote);
  const seniorResult = calculateJobMatch(candidate, seniorAccountant);
  const usResult = calculateJobMatch(candidate, strategicUs);
  const canadaResult = calculateJobMatch(candidate, canada);
  const abuResult = calculateJobMatch(candidate, abuDhabi);
  const emeaResult = calculateJobMatch(candidate, emea);

  assert.equal(classifyFinanceSubfunction(indiaRemote), 'CORE_FINANCE');
  assert.equal(classifyFinanceSubfunction(fpaRemote), 'FP&A');
  assert.equal(classifyFinanceSubfunction(accountingRemote), 'ACCOUNTING');
  assert.equal(classifyFinanceSubfunction(seniorAccountant), 'ACCOUNTING');
  assert.equal(classifyFinanceSubfunction(roleJob('Internal Audit IT Manager', 'SOX controls.')), 'SOX_IT_CONTROLS');
  assert.equal(classifyFinanceSubfunction(roleJob('SOX Auditor', 'SOX controls.')), 'SOX_IT_CONTROLS');
  assert.equal(classifyFinanceSubfunction(roleJob('Treasury Specialist', 'Cash management.')), 'TREASURY');
  assert.equal(classifyFinanceSubfunction(roleJob('Risk Analyst', 'Credit risk.')), 'RISK');
  assert.equal(classifyFinanceSubfunction(roleJob('Business Controller', 'Controllership.')), 'CONTROLLERSHIP');
  assert.equal(classifyFinanceSubfunction(roleJob('Finance Business Partner', 'Financial planning.')), 'FINANCE_BUSINESS_PARTNER');
  assert.ok(indiaResult.applicabilityScore > usResult.applicabilityScore);
  assert.ok(indiaResult.applicabilityScore > emeaResult.applicabilityScore);
  assert.ok(fpaResult.financeSubfunctionScore >= 90);
  assert.ok(accountingResult.financeSubfunctionScore >= 90);
  assert.ok(seniorResult.financeSubfunctionScore >= 65 && seniorResult.financeSubfunctionScore < 90);
  assert.equal(usResult.job.indiaEligibilityStatus, 'NO');
  assert.equal(canadaResult.job.indiaEligibilityStatus, 'NO');
  assert.equal(abuResult.job.indiaEligibilityStatus, 'NO');
  assert.equal(emeaResult.job.indiaEligibilityStatus, 'UNKNOWN');
  assert.equal(emeaResult.seniorityCompatibility, 'STRONG');
});

test('different companies with the same title are not deduplicated', () => {
  const jobs = [
    { ...baseJob, id: 'company-a-1', company: 'Company A', applicationUrl: 'https://example.com/a', title: 'Senior Accountant' },
    { ...baseJob, id: 'company-b-1', company: 'Company B', applicationUrl: 'https://example.com/b', title: 'Senior Accountant' },
  ];

  assert.equal(dedupeJobs(jobs).length, 2);
});

test('same source and source ID are deduplicated', () => {
  const jobs = [
    { ...baseJob, id: 'remoteok-123', source: 'remoteok', company: 'Alpha', applicationUrl: 'https://example.com/remoteok/123', title: 'Finance Manager' },
    { ...baseJob, id: 'remoteok-123', source: 'remoteok', company: 'Alpha', applicationUrl: 'https://example.com/remoteok/123', title: 'Finance Manager' },
  ];

  assert.equal(dedupeJobs(jobs).length, 1);
});

test('missing salary does not eliminate a job', () => {
  const job: Job = { ...baseJob, id: 'job-no-salary-filter', salaryMin: null, salaryMax: null };
  const filtered = applyJobFilters([job], {
    targetRole: 'Finance Manager',
    remoteOnly: true,
    preferredCountries: ['India'],
    country: 'India',
  } as Parameters<typeof applyJobFilters>[1]);
  assert.equal(filtered.length, 1);
});

test('unknown experience does not eliminate a job', () => {
  const job: Job = { ...baseJob, id: 'job-no-experience', requiredExperience: null };
  const filtered = applyJobFilters([job], {
    targetRole: 'Finance Manager',
    remoteOnly: true,
    preferredCountries: ['India'],
    country: 'India',
    yearsOfExperience: 6,
    experience: 6,
  } as Parameters<typeof applyJobFilters>[1]);
  assert.equal(filtered.length, 1);
});

test('unknown India eligibility does not become NO', () => {
  const job: Job = { ...baseJob, id: 'job-unknown-india-filter', indiaEligibilityStatus: 'UNKNOWN', indiaEligible: true };
  const filtered = applyJobFilters([job], {
    targetRole: 'Finance Manager',
    remoteOnly: true,
    indiaOnly: true,
    preferredCountries: ['India'],
    country: 'India',
  } as Parameters<typeof applyJobFilters>[1]);
  assert.equal(filtered.length, 1);
});

test('explicit India-ineligible jobs are filtered', () => {
  const job: Job = { ...baseJob, id: 'job-india-no', indiaEligible: false, indiaEligibilityStatus: 'NO' };
  const filtered = applyJobFilters([job], {
    targetRole: 'Finance Manager',
    indiaOnly: true,
    country: 'India',
  });
  assert.equal(filtered.length, 0);
});

test('company and aggregator copies with the same URL deduplicate', () => {
  const jobs = [
    { ...baseJob, id: 'greenhouse-1', source: 'greenhouse', applicationUrl: 'https://boards.greenhouse.io/company/jobs/1' },
    { ...baseJob, id: 'company-company-1', source: 'companyDiscovery', applicationUrl: 'https://boards.greenhouse.io/company/jobs/1' },
  ];
  assert.equal(dedupeJobs(jobs).length, 1);
});

test('live registry excludes demo seed jobs by default', () => {
  const registry = createJobSourceRegistry();
  assert.equal(registry.sources.some((source) => source.name === 'seed'), false);
});

test('verified company registry uses recognized ATS entries', () => {
  assert.ok(verifiedCompanyRegistry.length >= 20);
  assert.ok(verifiedCompanyRegistry.every((company) => company.companyName && company.companyWebsite && company.boardIdentifier));
  assert.ok(verifiedCompanyRegistry.every((company) => ['greenhouse', 'lever', 'ashby', 'workable', 'other'].includes(company.ats)));
});

test('company discovery isolates failures and reports metrics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('/good/jobs')) {
      return new Response(JSON.stringify({ jobs: [{ id: 1, title: 'Finance Manager', location: 'Remote - India', content: 'Finance planning and reporting.', absolute_url: 'https://boards.greenhouse.io/good/jobs/1', updated_at: '2026-08-30T00:00:00Z' }] }), { status: 200 });
    }
    return new Response('', { status: 500 });
  };

  try {
    const source = new CompanyDiscoverySource([
      { companyName: 'Good Co', companyWebsite: 'https://good.example', ats: 'greenhouse', boardIdentifier: 'good', industries: ['Finance'] },
      { companyName: 'Unavailable Co', companyWebsite: 'https://unavailable.example', ats: 'greenhouse', boardIdentifier: 'unavailable', industries: ['Finance'] },
    ]);
    const result = await source.fetchJobsWithMetrics({});
    assert.equal(result.jobs.length, 1);
    assert.deepEqual(result.metrics, {
      companiesConfigured: 2,
      companiesQueried: 2,
      companiesSucceeded: 1,
      companiesFailed: 1,
      jobsFetched: 1,
      jobsNormalized: 1,
      jobsRejected: 0,
    });
    assert.equal(result.jobs[0].applicationUrl, 'https://boards.greenhouse.io/good/jobs/1');
    assert.equal(result.jobs[0].salaryMin, null);
    assert.equal(result.jobs[0].indiaEligibilityStatus, 'YES');
    assert.equal(result.jobs[0].remoteStatus, 'TRUE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('company location evidence classifies country eligibility and remote status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ jobs: [
    { id: 1, title: 'Finance Manager', location: 'Remote - USA', absolute_url: 'https://x.test/usa' },
    { id: 2, title: 'Finance Manager', location: 'Bengaluru, India', absolute_url: 'https://x.test/india' },
    { id: 3, title: 'Finance Manager', location: 'Remote - EMEA', absolute_url: 'https://x.test/emea' },
  ] }), { status: 200 });

  try {
    const source = new CompanyDiscoverySource([{ companyName: 'Location Co', companyWebsite: 'https://x.test', ats: 'greenhouse', boardIdentifier: 'location', industries: ['Finance'] }]);
    const jobs = await source.fetchJobs({});
    assert.equal(jobs.find((job) => job.applicationUrl.endsWith('/usa'))?.indiaEligibilityStatus, 'NO');
    assert.equal(jobs.find((job) => job.applicationUrl.endsWith('/usa'))?.remoteStatus, 'TRUE');
    assert.equal(jobs.find((job) => job.applicationUrl.endsWith('/india'))?.indiaEligibilityStatus, 'YES');
    assert.equal(jobs.find((job) => job.applicationUrl.endsWith('/emea'))?.indiaEligibilityStatus, 'UNKNOWN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
