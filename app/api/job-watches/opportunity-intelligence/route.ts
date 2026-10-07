import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import {
  buildAutonomousOpportunityIntelligence,
  type OpportunityActionState,
  type OpportunitySignalEvent,
} from "@/lib/autonomous-opportunity-intelligence";

const normalize = (value: unknown) =>
  typeof value === "string" ? value.replace(/\/$/, "").toLowerCase() : "";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { data: watches, error: watchError } = await supabase
    .from("job_watches")
    .select("id")
    .eq("candidate_id", user.id)
    .eq("enabled", true);

  if (watchError) {
    return NextResponse.json({ error: "Unable to load opportunity watches." }, { status: 500 });
  }

  const watchIds = (watches ?? []).map((watch) => watch.id);
  if (!watchIds.length) {
    return NextResponse.json({
      opportunities: [],
      counts: { act_now: 0, review: 0, watch: 0, ignore: 0 },
      duplicateOpportunities: 0,
    });
  }

  const [{ data: events, error: eventError }, { data: actions, error: actionError }, { data: applications }] =
    await Promise.all([
      supabase
        .from("job_watch_events")
        .select("watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
        .in("watch_id", watchIds)
        .order("created_at", { ascending: false })
        .limit(1500),
      supabase
        .from("career_agent_actions")
        .select("job_fingerprint,action,task_status,outcome,source_url,created_at")
        .eq("candidate_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("applications")
        .select("status,jobs(application_url)")
        .eq("candidate_id", user.id)
        .limit(500),
    ]);

  if (eventError || actionError) {
    return NextResponse.json({ error: "Unable to build opportunity intelligence." }, { status: 500 });
  }

  const applicationByUrl = new Map<string, string>();
  for (const application of applications ?? []) {
    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const url = normalize(jobs?.application_url);
    if (url && application.status) applicationByUrl.set(url, application.status);
  }

  const actionByFingerprint = new Map<string, OpportunityActionState>();
  for (const action of actions ?? []) {
    const existing = actionByFingerprint.get(action.job_fingerprint);
    if (!existing || action.task_status === "open" || existing.taskStatus !== "open") {
      actionByFingerprint.set(action.job_fingerprint, {
        action: action.action,
        taskStatus: action.task_status,
        outcome: action.outcome,
      });
    }
  }

  const applicationsByFingerprint: Record<string, { status: string }> = {};
  for (const action of actions ?? []) {
    const status = applicationByUrl.get(normalize(action.source_url));
    if (status) applicationsByFingerprint[action.job_fingerprint] = { status };
  }

  const intelligence = buildAutonomousOpportunityIntelligence(
    (events ?? []) as OpportunitySignalEvent[],
    {
      applications: applicationsByFingerprint,
      actions: Object.fromEntries(actionByFingerprint.entries()),
      limit: 50,
    },
  );

  const counts = {
    act_now: intelligence.filter((item) => item.priority === "act_now").length,
    review: intelligence.filter((item) => item.priority === "review").length,
    watch: intelligence.filter((item) => item.priority === "watch").length,
    ignore: intelligence.filter((item) => item.priority === "ignore").length,
  };

  return NextResponse.json({
    opportunities: intelligence,
    counts,
    duplicateOpportunities: intelligence.filter((item) => item.isDuplicateAcrossWatches).length,
  });
}
