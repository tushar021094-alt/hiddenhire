import { NextResponse } from 'next/server';
import { buildExpandedRoleQueries, createJobSourceRegistry, type DiscoveryQuery } from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';

const registry = createJobSourceRegistry();

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use POST to search jobs with candidate preferences.',
    sources: registry.sources.map((source) => source.name),
  });
}

export async function POST(request: Request) {
  try {
    const profile = await request.json();
    const expandedRoles = buildExpandedRoleQueries(profile);
    const queries: DiscoveryQuery[] = expandedRoles.map((role) => ({
      targetRole: role,
      targetJobTitle: role,
      yearsOfExperience: profile.yearsOfExperience,
      minimumSalary: profile.minimumSalary,
      remoteOnly: profile.remoteOnly,
      country: profile.preferredCountries?.[0] || 'India',
      industry: profile.preferredIndustries?.[0] || '',
      experience: profile.yearsOfExperience,
      indiaOnly: profile.preferredCountries?.includes('India') || false,
      ...profile,
    }));

    const collected = await Promise.allSettled(
      queries.map((query) => registry.fetchJobs(query))
    );

    const collectedJobs = collected.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const deduped = Array.from(new Map(collectedJobs.map((job) => [`${job.company}:${job.title}:${job.applicationUrl}`, job])).values());
    const ranked = sortMatches(profile, deduped);
    const returned = ranked.slice(0, 20);
    const response = {
      totalCollected: collectedJobs.length,
      totalAfterDeduplication: deduped.length,
      totalEligible: ranked.length,
      totalRanked: ranked.length,
      returned: returned.length,
      matches: returned,
      queries: expandedRoles,
      sources: registry.sources.map((source) => source.name),
      debug: process.env.NODE_ENV === 'development' ? {
        sourcesQueried: registry.sources.map((source) => source.name),
        queriesUsed: expandedRoles,
        duplicateCount: Math.max(0, collectedJobs.length - deduped.length),
        excludedCount: Math.max(0, collectedJobs.length - ranked.length),
        resultsReturned: returned.length,
      } : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error', error);
    const fallback = await new (await import('@/lib/job-source')).SeedJobSource().fetchJobs();
    const fallbackMatches = sortMatches(await request.json().catch(() => ({})), fallback);

    return NextResponse.json(
      {
        totalCollected: fallback.length,
        totalAfterDeduplication: fallback.length,
        totalEligible: fallbackMatches.length,
        totalRanked: fallbackMatches.length,
        returned: fallbackMatches.length,
        matches: fallbackMatches,
        sources: ['seed'],
        warning: 'External providers failed. Seed demo data used as fallback.',
      },
      { status: 200 }
    );
  }
}
