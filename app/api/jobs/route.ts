import { NextResponse } from 'next/server';
import { SeedJobSource, createJobSourceRegistry } from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';

const registry = createJobSourceRegistry();
const fallbackSource = new SeedJobSource();

export async function POST(request: Request) {
  try {
    const profile = await request.json();
    const query = {
      targetRole: profile.targetJobTitle,
      targetJobTitle: profile.targetJobTitle,
      yearsOfExperience: profile.yearsOfExperience,
      minimumSalary: profile.minimumSalary,
      remoteOnly: profile.remoteOnly,
      country: profile.preferredCountries?.[0] || 'India',
      industry: profile.preferredIndustries?.[0] || '',
      experience: profile.yearsOfExperience,
      indiaOnly: profile.preferredCountries?.includes('India') || false,
      ...profile,
    };

    const jobs = await registry.fetchJobs(query);
    const results = sortMatches(profile, jobs);

    return NextResponse.json({
      count: results.length,
      matches: results,
      sources: registry.sources.map((source) => source.name),
    });
  } catch (error) {
    console.error('Job matching error', error);
    const fallbackJobs = await fallbackSource.fetchJobs();
    const profile = await request.json().catch(() => ({}));
    return NextResponse.json(
      {
        count: fallbackJobs.length,
        matches: sortMatches(profile, fallbackJobs),
        sources: ['seed'],
        warning: 'External providers failed. Seed demo data used as fallback.',
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  const jobs = await fallbackSource.fetchJobs();
  return NextResponse.json({ jobs, count: jobs.length, sources: ['seed'] });
}
