import { NextResponse } from 'next/server';
import { searchJobs, validSearchProfile } from '@/lib/job-search-service';
export { normalizeCandidateProfile, buildDiscoveryQueries, deduplicateJobs } from '@/lib/job-search-service';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { calibrateScore } from '@/lib/career-score-calibration';
import { buildAttributionInsights } from '@/lib/career-learning-attribution';

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

    const isDemo = Boolean(profile.demo || profile.demoMode === 'demo');
    if (isDemo && process.env.NODE_ENV !== 'production') {
      return NextResponse.json(await searchJobs(profile));
    }

    const auth = await getAuthenticatedUser();
    if (!auth.user) {
      return NextResponse.json(
        { error: "Sign in or create a HiddenHire account to search live jobs.", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    let calibrationAdjustment = 0;
    let learningPolicy: ReturnType<typeof buildAttributionInsights>["policy"] | undefined;
    {
      const { data: actions } = await auth.supabase
        .from("career_agent_actions")
        .select("action,source_url,outcome,decision_score,source_provider,job_function,job_title,is_remote")
        .eq("candidate_id", auth.user.id)
        .limit(500);
      const { data: applications } = await auth.supabase
        .from("applications")
        .select("status,jobs(application_url)")
        .eq("candidate_id", auth.user.id)
        .limit(500);
      const normalize = (value: unknown) => typeof value === "string" ? value.replace(/\/$/, "").toLowerCase() : "";
      const applicationByUrl = new Map<string, string>();
      for (const application of applications ?? []) {
        const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
        const url = normalize(jobs?.application_url);
        if (url) applicationByUrl.set(url, application.status);
      }
      const observations = (actions ?? [])
        .map((action) => ({ score: Number(action.decision_score || 0), outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started" }))
        .filter((item) => item.outcome !== "not_started");
      const calibration = calibrateScore(observations);
      calibrationAdjustment = calibration.eligible ? calibration.adjustment : 0;
      const attributionObservations = (actions ?? [])
        .map((action) => ({
          action: action.action || "unknown",
          decisionScore: Number(action.decision_score || 0),
          outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started",
          source: action.source_provider || "unknown",
          role: action.job_function || action.job_title || "unknown",
          remote: Boolean(action.is_remote),
        }))
        .filter((item) => item.outcome !== "not_started");
      learningPolicy = buildAttributionInsights(attributionObservations).policy;
    }
    return NextResponse.json(await searchJobs(profile, calibrationAdjustment, learningPolicy));
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
