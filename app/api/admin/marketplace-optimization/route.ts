import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeMarketplace } from "@/lib/marketplace-optimization";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id,title,company_id,posted_by,status,visibility,created_at,companies(name)")
    .in("status", ["published", "pending_review"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (jobsError) return NextResponse.json({ error: "Unable to load marketplace jobs." }, { status: 500 });

  const ids = (jobs ?? []).map((job) => job.id);
  if (!ids.length) return NextResponse.json({ items: [], counts: { total: 0, promote: 0, prioritize: 0, improve: 0, limit: 0, hold: 0 } });

  const [authenticityResult, safetyResult, moderationResult, qualityResult] = await Promise.all([
    supabase.from("job_authenticity").select("job_id,score,verified_job,verified_company,verified_recruiter").in("job_id", ids),
    supabase.from("job_safety_risk").select("job_id,score,tier,action").in("job_id", ids),
    supabase.from("moderation_cases").select("job_id,status").in("job_id", ids).in("status", ["open","under_review","appealed"]),
    supabase.from("recruiter_quality").select("recruiter_id,responsiveness_score,response_rate,trust_score,identity_verified,company_verified"),
  ]);

  const authenticity = new Map((authenticityResult.data ?? []).map((row) => [row.job_id, row]));
  const safety = new Map((safetyResult.data ?? []).map((row) => [row.job_id, row]));
  const openCases = new Set((moderationResult.data ?? []).map((row) => row.job_id));
  const quality = new Map((qualityResult.data ?? []).map((row) => [row.recruiter_id, row]));

  const items = (jobs ?? []).map((job) => {
    const auth = authenticity.get(job.id);
    const risk = safety.get(job.id);
    const recruiter = job.posted_by ? quality.get(job.posted_by) : undefined;
    const decision = optimizeMarketplace({
      audience: "platform",
      jobAuthenticityScore: auth?.score ?? null,
      fraudRiskTier: (risk?.tier as "low"|"guarded"|"high"|"critical"|undefined) ?? null,
      recruiterTrustScore: recruiter?.trust_score ?? null,
      recruiterResponseRate: recruiter?.response_rate ?? null,
      isVerified: Boolean(auth?.verified_job && auth?.verified_company && auth?.verified_recruiter),
      hasOpenModerationCase: openCases.has(job.id) || risk?.action === "restrict" || risk?.action === "escalate",
    });
    return {
      jobId: job.id,
      title: job.title,
      company: Array.isArray(job.companies) ? job.companies[0]?.name ?? "Company undisclosed" : (job.companies as {name?:string}|null)?.name ?? "Company undisclosed",
      status: job.status,
      visibility: job.visibility,
      decision,
    };
  }).sort((a, b) => a.decision.score - b.decision.score);

  const counts = { total: items.length, promote: 0, prioritize: 0, improve: 0, limit: 0, hold: 0 };
  for (const item of items) counts[item.decision.action] += 1;
  return NextResponse.json({ items, counts, generatedAt: new Date().toISOString() });
}
