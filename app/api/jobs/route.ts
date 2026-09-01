import { NextResponse } from 'next/server';
import { SeedJobSource } from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';

const source = new SeedJobSource();

export async function POST(request: Request) {
  try {
    const profile = await request.json();
    const jobs = await source.getJobs();
    const results = sortMatches(profile, jobs);

    return NextResponse.json({
      count: results.length,
      matches: results,
    });
  } catch (error) {
    console.error('Job matching error', error);
    return NextResponse.json(
      { error: 'Unable to process job matches right now.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const jobs = await source.getJobs();
  return NextResponse.json({ jobs, count: jobs.length });
}
