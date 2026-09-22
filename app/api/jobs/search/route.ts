import { NextResponse } from 'next/server';
import type { CandidateProfile } from '@/lib/job-types';
import {
  applyJobFilters,
  buildExpandedRoleQueries,
  createJobSourceRegistry,
  type DiscoveryQuery,
} from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';

const registry = createJobSourceRegistry();

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

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use POST to search jobs with candidate preferences.',
    sources: registry.sources.map((source) => source.name),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const profile = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const demoMode = Boolean(profile.demo || profile.demoMode === 'demo');
    const expandedRoles = buildExpandedRoleQueries(profile as Parameters<typeof buildExpandedRoleQueries>[0]);
    const candidateProfile = normalizeCandidateProfile(profile, expandedRoles);
    const queries = buildDiscoveryQueries(profile, candidateProfile, expandedRoles);

    if (demoMode) {
      const demoJobs = await new (await import('@/lib/job-source')).SeedJobSource().fetchJobs();
      const demoMatches = sortMatches(candidateProfile, demoJobs);
      return NextResponse.json({
        dataMode: 'demo',
        results: demoMatches,
        count: demoMatches.length,
        message: 'Demo mode enabled.',
        sources: ['seed'],
      });
    }

    const inventoryQuery = { ...queries[0], targetRole: '', targetJobTitle: '' };
    const collected = await registry.fetchJobsWithMetrics(inventoryQuery);
    const collectedJobs = collected.jobs;
    const deduped = Array.from(new Map(collectedJobs.map((job) => [`${job.company}:${job.title}:${job.applicationUrl}`, job])).values());
    const roleMatched = deduped.filter((job) => queries.some((query) => applyJobFilters([job], query).length > 0));
    const ranked = sortMatches(candidateProfile, roleMatched);
    const returned = ranked.slice(0, 20);
    const sourceMetrics = collected.metrics;

    const response = {
      dataMode: 'live',
      results: returned,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error', error);
    return NextResponse.json(
      {
        dataMode: 'live',
        results: [],
        count: 0,
        totalCollected: 0,
        totalAfterDeduplication: 0,
        totalEligible: 0,
        totalRanked: 0,
        returned: 0,
        message: 'No strong matches found. Try expanding your search.',
        sources: registry.sources.map((source) => source.name),
      },
      { status: 200 }
    );
  }
}
