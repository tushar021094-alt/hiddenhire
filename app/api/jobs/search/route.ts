import { NextResponse } from 'next/server';
import { searchJobs, validSearchProfile } from '@/lib/job-search-service';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';

const MAX_BODY_BYTES = 64_000;

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use POST to search jobs with candidate preferences.',
  });
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`jobs-search:${getClientIdentifier(request)}`, 20, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const profile =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};

    if (!validSearchProfile(profile)) {
      return NextResponse.json(
        { error: 'Please provide a valid job search profile.' },
        { status: 400 },
      );
    }

    return NextResponse.json(await searchJobs(profile));
  } catch (error) {
    console.error('Search error', error);
    return NextResponse.json(
      {
        dataMode: 'live',
        results: [],
        count: 0,
        returned: 0,
        message: 'No strong matches found. Try expanding your search.',
      },
      { status: 503 },
    );
  }
}
