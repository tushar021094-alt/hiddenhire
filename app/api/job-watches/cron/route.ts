import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanJobWatch } from "@/lib/job-watch-scan";
import { buildAutonomousScanPolicy } from "@/lib/career-autonomous-policy";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(token) && token === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();
    const { data: watches, error } = await supabase
      .from("job_watches")
      .select("id,name,candidate_id,target_roles,preferred_locations,preferred_countries,skills,minimum_salary,currency,remote_only,min_match_score,last_scanned_at")
      .eq("enabled", true)
      .order("last_scanned_at", { ascending: true, nullsFirst: true })
      .limit(20);

    if (error) {
      console.error("[job-watch-cron] failed to load watches", error);
      return NextResponse.json({ error: "Unable to load active job watches." }, { status: 500 });
    }

    const results = [];
    const policyCache = new Map<string, ReturnType<typeof buildAutonomousScanPolicy>>();

    for (const watch of watches ?? []) {
      try {
        let scanPolicy = policyCache.get(watch.candidate_id);
        if (!scanPolicy) {
          const { data: actions } = await supabase
            .from("career_agent_actions")
            .select("source_url,decision_score,outcome,source_provider,job_function,is_remote")
            .eq("candidate_id", watch.candidate_id)
            .limit(500);
          const { data: applications } = await supabase
            .from("applications")
            .select("status,jobs(application_url)")
            .eq("candidate_id", watch.candidate_id)
            .limit(500);

          const normalize = (value: unknown) => typeof value === "string"
            ? value.replace(/\/$/, "").toLowerCase()
            : "";
          const applicationByUrl = new Map<string, string>();
          for (const application of applications ?? []) {
            const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
            const url = normalize(jobs?.application_url);
            if (url) applicationByUrl.set(url, application.status);
          }

          scanPolicy = buildAutonomousScanPolicy(
            (actions ?? [])
              .map((action) => ({
                action: "career_agent",
                decisionScore: Number(action.decision_score || 0),
                outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started",
                source: action.source_provider || "unknown",
                role: action.job_function || "unknown",
                remote: Boolean(action.is_remote),
              }))
              .filter((item) => item.outcome !== "not_started"),
          );
          policyCache.set(watch.candidate_id, scanPolicy);
        }

        results.push(await scanJobWatch(supabase, watch, undefined, scanPolicy));
      } catch (watchError) {
        console.error("[job-watch-cron] watch scan failed", watch.id, watchError);
        results.push({
          watchId: watch.id,
          watchName: watch.name,
          scanned: 0,
          eventsCreated: 0,
          error: "Watch scan failed.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      watchesProcessed: results.length,
      eventsCreated: results.reduce((total, result) => total + Number(result.eventsCreated || 0), 0),
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    console.error("[job-watch-cron] failed", error);
    return NextResponse.json({ error: "Job watch automation failed." }, { status: 500 });
  }
}
