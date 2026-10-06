import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { optimizeCareerQueue } from "@/lib/career-agent-queue";

type Action = {
  id: string;
  job_fingerprint: string;
  action: string;
  decision_score: number;
  source_url: string;
  job_title: string | null;
  company_name: string | null;
  job_location: string | null;
  workflow: Record<string, unknown> | null;
  task_status: "open" | "completed" | "dismissed";
  effective_status: "open" | "completed" | "dismissed";
  application_status: string | null;
  due_at: string | null;
  created_at: string;
  [key: string]: unknown;
};

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data: actions, error } = await supabase
    .from("career_agent_actions")
    .select("id,job_fingerprint,action,decision_score,source_url,job_title,company_name,job_location,workflow,task_status,completed_at,due_at,outcome,outcome_at,outcome_source,created_at")
    .eq("candidate_id", user.id)
    .eq("task_status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Unable to build today's Career Agent queue." }, { status: 500 });

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

  const now = Date.now();
  const today: Action[] = (actions ?? []).map((item) => {
    const applicationStatus = applicationByUrl.get(normalize(item.source_url)) ?? null;
    let effectiveStatus: Action["effective_status"] = item.task_status;
    if (item.action === "follow_up" && applicationStatus && ["reviewing", "shortlisted", "interview", "hired", "rejected", "withdrawn"].includes(applicationStatus)) effectiveStatus = "completed";
    if (item.action === "prepare" && applicationStatus && ["rejected", "withdrawn", "hired"].includes(applicationStatus)) effectiveStatus = "dismissed";
    return {
      ...item,
      application_status: applicationStatus,
      effective_status: effectiveStatus,
      overdue: item.due_at !== null && new Date(item.due_at).getTime() <= now,
      outcome: applicationStatus ?? item.outcome,
      outcome_at: applicationStatus ? new Date().toISOString() : item.outcome_at,
      outcome_source: applicationStatus ? "application" : item.outcome_source,
    };
  });

  const openCount = today.filter((item) => item.effective_status === "open").length;
  const optimized = optimizeCareerQueue(today, now, 12);
  return NextResponse.json({
    items: optimized,
    count: optimized.length,
    suppressed: Math.max(0, openCount - optimized.length),
  });
}
