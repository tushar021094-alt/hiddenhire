import type { CandidateProfile } from '@/lib/job-types';
import { createClient } from '@/lib/supabase/server';
import { evaluateJobAuthenticity } from '@/lib/job-authenticity';
import { evaluateFraudRisk } from '@/lib/fraud-risk';
import {
  buildExpandedRoleQueries,
  createJobSourceRegistry,
  type DiscoveryQuery,
} from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';
import {
  buildCandidateSearchIntent,
  isJobEligible,
} from '@/lib/search-policy';

const registry = createJobSourceRegistry();

const MAX_BODY_BYTES = 64_000;
const MAX_TEXT_LENGTH = 500;
const MAX_RESUME_LENGTH = 20_000;
const MAX_ARRAY_ITEMS = 30;

export function validSearchProfile(profile: Record<string, unknown>) {
  const role =
    typeof profile.targetJobTitle === 'string'
      ? profile.targetJobTitle
      : profile.targetRole;

  if (typeof role !== 'string' || role.length === 0 || role.length > MAX_TEXT_LENGTH) {
    return false;
  }

  if (
    typeof profile.resumeText === 'string' &&
    profile.resumeText.length > MAX_RESUME_LENGTH
  ) {
    return false;
  }

  if (
    typeof profile.yearsOfExperience === 'number' &&
    (!Number.isFinite(profile.yearsOfExperience) ||
      profile.yearsOfExperience < 0 ||
      profile.yearsOfExperience > 60)
  ) {
    return false;
  }

  if (
    typeof profile.minimumSalary === 'number' &&
    (!Number.isFinite(profile.minimumSalary) ||
      profile.minimumSalary < 0 ||
      profile.minimumSalary > 1_000_000_000)
  ) {
    return false;
  }

  for (const key of [
    'preferredCountries',
    'preferredIndustries',
    'skills',
    'keySkills',
    'targetRoles',
    'preferredLocations',
  ]) {
    const value = profile[key];
    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.length > MAX_ARRAY_ITEMS ||
        !value.every(
          (item) => typeof item === 'string' && item.length <= MAX_TEXT_LENGTH,
        ))
    ) {
      return false;
    }
  }

  return true;
}

export function normalizeCandidateProfile(
  profile: Record<string, unknown>,
  expandedRoles: string[]
): CandidateProfile {
  const preferredCountries = Array.isArray(profile.preferredCountries)
    ? profile.preferredCountries.filter(
        (value): value is string => typeof value === 'string'
      )
    : [];

  return {
    resumeText: typeof profile.resumeText === 'string' ? profile.resumeText : '',
    targetJobTitle:
      typeof profile.targetJobTitle === 'string'
        ? profile.targetJobTitle
        : typeof profile.targetRole === 'string'
          ? profile.targetRole
          : expandedRoles[0] || '',
    yearsOfExperience:
      typeof profile.yearsOfExperience === 'number'
        ? profile.yearsOfExperience
        : 0,
    minimumSalary:
      typeof profile.minimumSalary === 'number'
        ? profile.minimumSalary
        : 0,
    preferredCurrency:
      profile.preferredCurrency === 'USD' ||
      profile.preferredCurrency === 'INR' ||
      profile.preferredCurrency === 'EUR' ||
      profile.preferredCurrency === 'GBP'
        ? profile.preferredCurrency
        : 'INR',
    preferredCountries: preferredCountries.length > 0 ? preferredCountries : ['India'],
    preferredLocations: Array.isArray(profile.preferredLocations)
      ? profile.preferredLocations.filter(
          (value): value is string => typeof value === 'string'
        )
      : [],
    remoteOnly: Boolean(profile.remoteOnly),
    preferredIndustries: Array.isArray(profile.preferredIndustries)
      ? profile.preferredIndustries.filter(
          (value): value is string => typeof value === 'string'
        )
      : [],
    keySkills: Array.isArray(profile.skills)
      ? profile.skills.filter(
          (value): value is string => typeof value === 'string'
        )
      : Array.isArray(profile.keySkills)
        ? profile.keySkills.filter(
            (value): value is string => typeof value === 'string'
          )
        : [],
  };
}

export function buildDiscoveryQueries(
  profile: Record<string, unknown>,
  candidateProfile: CandidateProfile,
  expandedRoles: string[]
): DiscoveryQuery[] {
  return expandedRoles.map((role) => ({
    ...profile,
    targetRole: role,
    targetJobTitle: role,
    yearsOfExperience: candidateProfile.yearsOfExperience,
    minimumSalary: candidateProfile.minimumSalary,
    remoteOnly: candidateProfile.remoteOnly,
    country: candidateProfile.preferredCountries[0] || 'India',
    industry: candidateProfile.preferredIndustries[0] || '',
    experience: candidateProfile.yearsOfExperience,
    indiaOnly: candidateProfile.preferredCountries.some(
      (country) => country.toLowerCase() === 'india'
    ),
  }));
}


function normalizeApplicationUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

export function deduplicateJobs<T extends { company: string; title: string; location: string; applicationUrl: string }>(jobs: T[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const fingerprint = [
      job.company.trim().toLowerCase(),
      job.title.trim().toLowerCase(),
      job.location.trim().toLowerCase(),
      normalizeApplicationUrl(job.applicationUrl),
    ].join('|');
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}


export async function searchJobs(
  profile: Record<string, unknown>,
  calibrationAdjustment = 0,
  learningPolicy?: Parameters<typeof sortMatches>[3],
) {
  const expandedRoles = buildExpandedRoleQueries(profile as Parameters<typeof buildExpandedRoleQueries>[0]);
  const candidateProfile = normalizeCandidateProfile(profile, expandedRoles);
  const queries = buildDiscoveryQueries(profile, candidateProfile, expandedRoles);

  const demoMode = Boolean(profile.demo || profile.demoMode === 'demo');
  if (demoMode) {
    const demoJobs = await new (await import('@/lib/job-source')).SeedJobSource().fetchJobs();
    const demoMatches = sortMatches(candidateProfile, demoJobs, calibrationAdjustment, learningPolicy);
    return {
    dataMode: 'demo',
    results: demoMatches,
    count: demoMatches.length,
    message: 'Demo mode enabled.',
    sources: ['seed'],
    };
  }

  const inventoryQuery = { ...queries[0], targetRole: '', targetJobTitle: '' };
  const collected = await registry.fetchJobsWithMetrics(inventoryQuery);
  const collectedJobs = collected.jobs;
  const deduped = deduplicateJobs(collectedJobs);
  const searchIntent = buildCandidateSearchIntent({
  ...candidateProfile,
  targetRoles: Array.isArray(profile.targetRoles)
  ? profile.targetRoles.filter(
    (value): value is string => typeof value === "string",
    )
  : [],
  preferredLocations: Array.isArray(profile.preferredLocations)
  ? profile.preferredLocations.filter(
    (value): value is string => typeof value === "string",
    )
  : [],
  country:
  typeof profile.country === "string"
    ? profile.country
    : "India",
});

const roleMatched = deduped.filter((job) =>
  isJobEligible(searchIntent, job),
);
  const ranked = sortMatches(candidateProfile, roleMatched, calibrationAdjustment, learningPolicy);
  const returned = ranked.slice(0, 20);

  const duplicateCounts = new Map<string, number>();
  for (const job of collectedJobs) {
    const key = [job.company, job.title, job.location]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('|');
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  const nativeIds = returned
    .filter((match) => String(match.job.source || '').toLowerCase() === 'hiddenhire' && /^[0-9a-f-]{36}$/i.test(match.job.id))
    .map((match) => match.job.id);

  type PersistedAuthenticityRow = {
    job_id: string;
    score: number;
    tier: string;
    verified_job: boolean;
    verified_company: boolean;
    verified_recruiter: boolean;
    source_verified: boolean;
    duplicate_count: number;
    flags: unknown;
    signals: unknown;
  };

  const authenticityClient = await createClient();
  const authenticityRows = nativeIds.length
    ? (((await authenticityClient
        .from('job_authenticity')
        .select('job_id, score, tier, verified_job, verified_company, verified_recruiter, source_verified, duplicate_count, flags, signals')
        .in('job_id', nativeIds)).data ?? []) as PersistedAuthenticityRow[])
    : [];

  const authenticityByJob = new Map<string, PersistedAuthenticityRow>(
    authenticityRows.map((row) => [row.job_id, row]),
  );

  type PersistedSafetyRow = {
    job_id: string;
    score: number;
    tier: string;
    action: string;
    flags: unknown;
    signals: unknown;
  };

  const safetyRows = nativeIds.length
    ? (((await authenticityClient
        .from('job_safety_risk')
        .select('job_id, score, tier, action, flags, signals')
        .in('job_id', nativeIds)).data ?? []) as PersistedSafetyRow[])
    : [];

  const safetyByJob = new Map<string, PersistedSafetyRow>(
    safetyRows.map((row) => [row.job_id, row]),
  );
  const enrichedResults = returned.map((match) => {
    const persisted = authenticityByJob.get(match.job.id);
    const duplicateKey = [match.job.company, match.job.title, match.job.location]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('|');
    const duplicateCount = persisted?.duplicate_count ?? Math.max(0, (duplicateCounts.get(duplicateKey) ?? 1) - 1);
    const authenticity = persisted
      ? {
          score: Number(persisted.score),
          tier: persisted.tier as 'verified' | 'likely_authentic' | 'review' | 'caution',
          verifiedJob: Boolean(persisted.verified_job),
          verifiedCompany: Boolean(persisted.verified_company),
          verifiedRecruiter: Boolean(persisted.verified_recruiter),
          sourceVerified: Boolean(persisted.source_verified),
          duplicateCount,
          flags: Array.isArray(persisted.flags) ? persisted.flags.map(String) : [],
          signals: Array.isArray(persisted.signals) ? persisted.signals.map(String) : [],
        }
      : evaluateJobAuthenticity({
          source: match.job.source,
          company: match.job.company,
          companyWebsite: match.job.companyWebsite,
          applicationUrl: match.job.applicationUrl,
          description: match.job.description,
          salaryMin: match.job.salaryMin,
          salaryMax: match.job.salaryMax,
          duplicateCount,
        });

    const persistedSafety = safetyByJob.get(match.job.id);
    const safety = persistedSafety
      ? {
          score: Number(persistedSafety.score),
          tier: persistedSafety.tier as 'low' | 'guarded' | 'high' | 'critical',
          action: persistedSafety.action as 'allow' | 'warn' | 'restrict' | 'escalate',
          flags: Array.isArray(persistedSafety.flags) ? persistedSafety.flags.map(String) : [],
          signals: Array.isArray(persistedSafety.signals) ? persistedSafety.signals.map(String) : [],
        }
      : evaluateFraudRisk({
          authenticityScore: authenticity.score,
          authenticityTier: authenticity.tier,
          duplicateCount: authenticity.duplicateCount,
        });

    return {
      ...match,
      job: {
        ...match.job,
        authenticity,
        safety,
      },
    };
  });

  const sourceMetrics = collected.metrics;

  const response = {
    dataMode: 'live',
    results: enrichedResults,
    count: returned.length,
    totalCollected: collectedJobs.length,
    totalAfterDeduplication: deduped.length,
    totalEligible: roleMatched.length,
    totalRanked: ranked.length,
    returned: returned.length,
    message: returned.length > 0 ? 'Real opportunities found.' : 'No strong matches found. Try expanding your search.',
    queries: expandedRoles,
    sources: registry.sources.map((source) => source.name),
    metrics: {
    ...sourceMetrics,
    sources: sourceMetrics.sources && typeof sourceMetrics.sources === 'object' ? sourceMetrics.sources : registry.sources.reduce<Record<string, number>>((acc, source) => ({ ...acc, [source.name]: 0 }), {}),
    },
    debug: process.env.NODE_ENV === 'development' ? {
    sourcesQueried: registry.sources.map((source) => source.name),
    queriesUsed: expandedRoles,
    duplicateCount: Math.max(0, collectedJobs.length - deduped.length),
    excludedCount: Math.max(0, collectedJobs.length - roleMatched.length),
    resultsReturned: returned.length,
    } : undefined,
  };



  return response;
}
