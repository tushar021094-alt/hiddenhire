import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanJobWatch } from "@/lib/job-watch-scan";

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
    for (const watch of watches ?? []) {
      try {
        results.push(await scanJobWatch(supabase, watch));
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
