import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

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
};

const rank: Record<string, number> = {
  prepare: 100,
  follow_up: 90,
  apply_now: 85,
  review: 70,
  watch: 40,
};

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data: actions, error } = await supabase
    .from("career_agent_actions")
    .select("id,job_fingerprint,action,decision_score,source_url,job_title,company_name,job_location,workflow,task_status,completed_at,due_at,created_at")
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
  const today = (actions ?? []).map((item) => {
    const applicationStatus = applicationByUrl.get(normalize(item.source_url)) ?? null;
    let effectiveStatus: Action["effective_status"] = item.task_status;
    if (item.action === "follow_up" && applicationStatus && ["reviewing", "shortlisted", "interview", "hired", "rejected", "withdrawn"].includes(applicationStatus)) effectiveStatus = "completed";
    if (item.action === "prepare" && applicationStatus && ["rejected", "withdrawn", "hired"].includes(applicationStatus)) effectiveStatus = "dismissed";
    const due = item.due_at ? new Date(item.due_at).getTime() : null;
    const overdue = due !== null && due <= now;
    const urgencyBoost = overdue ? 35 : 0;
    const score = rank[item.action] + urgencyBoost + Math.min(15, Math.round(Number(item.decision_score || 0) / 10));
    return { ...item, application_status: applicationStatus, effective_status: effectiveStatus, overdue, priority_score: score };
  })
    .filter((item) => item.effective_status === "open")
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 20);

  return NextResponse.json({ items: today, count: today.length });
}
