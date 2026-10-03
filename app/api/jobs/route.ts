import { NextResponse } from 'next/server';
import { SeedJobSource, createJobSourceRegistry } from '@/lib/job-source';
import { sortMatches } from '@/lib/match-engine';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';

const registry = createJobSourceRegistry();
const fallbackSource = new SeedJobSource();
const MAX_BODY_BYTES = 32_000;
const MAX_TEXT_LENGTH = 200;
const MAX_ARRAY_ITEMS = 30;

function validProfile(profile: Record<string, unknown>) {
  const role = typeof profile.targetJobTitle === 'string' ? profile.targetJobTitle : profile.targetRole;
  if (typeof role !== 'string' || !role.trim() || role.length > MAX_TEXT_LENGTH) return false;
  if (typeof profile.yearsOfExperience === 'number' && (!Number.isFinite(profile.yearsOfExperience) || profile.yearsOfExperience < 0 || profile.yearsOfExperience > 60)) return false;
  if (typeof profile.minimumSalary === 'number' && (!Number.isFinite(profile.minimumSalary) || profile.minimumSalary < 0 || profile.minimumSalary > 1_000_000_000)) return false;
  for (const key of ['preferredCountries','preferredIndustries','skills','keySkills']) {
    if (profile[key] !== undefined && (!Array.isArray(profile[key]) || profile[key].length > MAX_ARRAY_ITEMS || !profile[key].every(v => typeof v === 'string' && v.length <= MAX_TEXT_LENGTH))) return false;
  }
  return true;
}

function isDemoRequest(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  return record.demo === true || record.demoMode === 'demo';
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`jobs:${getClientIdentifier(request)}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    const payload = await request.json();
    const profile = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    if (!validProfile(profile)) return NextResponse.json({ error: 'Please provide a valid job profile.' }, { status: 400 });
    const demoMode = isDemoRequest(payload);

    const query = {
      targetRole: typeof profile.targetJobTitle === 'string' ? profile.targetJobTitle : profile.targetRole,
      targetJobTitle: typeof profile.targetJobTitle === 'string' ? profile.targetJobTitle : profile.targetRole,
      yearsOfExperience: typeof profile.yearsOfExperience === 'number' ? profile.yearsOfExperience : 0,
      minimumSalary: typeof profile.minimumSalary === 'number' ? profile.minimumSalary : 0,
      remoteOnly: Boolean(profile.remoteOnly),
      country: Array.isArray(profile.preferredCountries) && typeof profile.preferredCountries[0] === 'string' ? profile.preferredCountries[0] : 'India',
      industry: Array.isArray(profile.preferredIndustries) && typeof profile.preferredIndustries[0] === 'string' ? profile.preferredIndustries[0] : '',
      experience: typeof profile.yearsOfExperience === 'number' ? profile.yearsOfExperience : 0,
      indiaOnly: Array.isArray(profile.preferredCountries) ? profile.preferredCountries.includes('India') : false,
      ...profile,
    };

    if (demoMode) {
      const demoJobs = await fallbackSource.fetchJobs();
      const demoResults = sortMatches(profile as unknown as Parameters<typeof sortMatches>[0], demoJobs);
      return NextResponse.json({
        dataMode: 'demo',
        results: demoResults,
        count: demoResults.length,
        message: 'Demo mode enabled.',
        sources: ['seed'],
      });
    }

    const { jobs, metrics, diagnostics } = await registry.fetchJobsWithMetrics(query as Parameters<typeof registry.fetchJobsWithMetrics>[0]);
    const results = sortMatches(profile as unknown as Parameters<typeof sortMatches>[0], jobs);

    return NextResponse.json({
      dataMode: 'live',
      results,
      count: results.length,
      message: results.length > 0 ? 'Real opportunities found.' : 'No strong matches found. Try expanding your search.',
      sources: registry.sources.map((source) => source.name),
      metrics,
      diagnostics,
    });
  } catch (error) {
    console.error('Job matching error', error);
    return NextResponse.json(
      {
        dataMode: 'live',
        results: [],
        count: 0,
        message: 'No strong matches found. Try expanding your search.',
        sources: registry.sources.map((source) => source.name),
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    dataMode: 'live',
    results: [],
    count: 0,
    message: 'Use POST to search jobs with candidate preferences.',
    sources: registry.sources.map((source) => source.name),
  });
}
