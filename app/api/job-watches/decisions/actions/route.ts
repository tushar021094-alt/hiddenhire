import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data, error } = await supabase
    .from("career_agent_actions")
    .select("id,job_fingerprint,action,decision_score,source_url,job_title,company_name,job_location,workflow,task_status,completed_at,due_at,last_reminded_at,outcome,outcome_at,outcome_source,created_at")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Unable to load Career Agent action history." }, { status: 500 });

  const { data: applications } = await supabase
    .from("applications")
    .select("status,jobs(application_url)")
    .eq("candidate_id", user.id)
    .limit(100);

  const normalize = (value: unknown) => typeof value === "string" ? value.replace(/\/$/, "").toLowerCase() : "";
  const applicationByUrl = new Map<string, string>();
  for (const application of applications ?? []) {
    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const url = normalize(jobs?.application_url);
    if (url) applicationByUrl.set(url, application.status);
  }

  const actions = (data ?? []).map((action) => {
    const applicationStatus = applicationByUrl.get(normalize(action.source_url)) ?? null;
    let effectiveStatus = action.task_status;
    if (action.action === "follow_up" && applicationStatus && ["reviewing", "shortlisted", "interview", "hired", "rejected", "withdrawn"].includes(applicationStatus)) {
      effectiveStatus = "completed";
    }
    if (action.action === "prepare" && applicationStatus && ["rejected", "withdrawn", "hired"].includes(applicationStatus)) {
      effectiveStatus = "dismissed";
    }
    return { ...action, application_status: applicationStatus, effective_status: effectiveStatus, outcome: applicationStatus ?? action.outcome, outcome_at: applicationStatus ? new Date().toISOString() : action.outcome_at, outcome_source: applicationStatus ? "application" : action.outcome_source };
  });

  const openActions = actions.filter((action) => action.effective_status === "open");

  return NextResponse.json({ actions, open_actions: openActions, open_count: openActions.length });
}
