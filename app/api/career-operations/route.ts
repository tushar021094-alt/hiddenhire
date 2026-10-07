import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildAutonomousOpportunityIntelligence, type OpportunitySignalEvent } from "@/lib/autonomous-opportunity-intelligence";
import { buildCareerOperations, type CareerOperationAction, type CareerOperationApplication, type CareerOperationOpportunity } from "@/lib/career-operations";

const normalize = (value: unknown) => typeof value === "string" ? value.replace(/\/$/, "").toLowerCase() : "";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const [{ data: profile }, { data: career }, { data: applications, error: applicationsError }, { data: actions, error: actionsError }, { data: watches }] = await Promise.all([
    supabase.from("profiles").select("full_name,skills,experience_years,location").eq("id", user.id).maybeSingle(),
    supabase.from("candidate_profiles").select("headline,target_roles,preferred_locations").eq("profile_id", user.id).maybeSingle(),
    supabase.from("applications").select("id,status,created_at,updated_at,jobs(title,application_url,companies(name))").eq("candidate_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("career_agent_actions").select("id,job_fingerprint,action,task_status,due_at,job_title,company_name,source_url").eq("candidate_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("job_watches").select("id").eq("candidate_id", user.id).eq("enabled", true),
  ]);

  if (applicationsError || actionsError) return NextResponse.json({ error: "Unable to build Career Operations." }, { status: 500 });

  const watchIds = (watches ?? []).map((watch) => watch.id);
  let opportunities: CareerOperationOpportunity[] = [];

  if (watchIds.length) {
    const { data: events, error } = await supabase
      .from("job_watch_events")
      .select("watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
      .in("watch_id", watchIds)
      .order("created_at", { ascending: false })
      .limit(1200);

    if (error) return NextResponse.json({ error: "Unable to build opportunity operations." }, { status: 500 });

    const applicationByUrl = new Map<string, string>();
    for (const application of applications ?? []) {
      const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
      const url = normalize(job?.application_url);
      if (url) applicationByUrl.set(url, application.status);
    }

    const actionMap: Record<string, { action?: string | null; taskStatus?: string | null; outcome?: string | null }> = {};
    for (const action of actions ?? []) {
      if (!actionMap[action.job_fingerprint]) actionMap[action.job_fingerprint] = {
        action: action.action,
        taskStatus: action.task_status,
      };
    }

    const applicationsByFingerprint: Record<string, { status: string }> = {};
    for (const event of events ?? []) {
      const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
      const url = normalize(payload.applicationUrl);
      const status = applicationByUrl.get(url);
      if (status) applicationsByFingerprint[event.job_fingerprint] = { status };
    }

    const intelligence = buildAutonomousOpportunityIntelligence((events ?? []) as OpportunitySignalEvent[], {
      applications: applicationsByFingerprint,
      actions: actionMap,
      limit: 30,
    });

    opportunities = intelligence.map((item) => ({
      jobFingerprint: item.jobFingerprint,
      title: item.title,
      company: item.company,
      applicationUrl: item.applicationUrl,
      priority: item.priority,
      attentionScore: item.attentionScore,
      applicationStatus: item.applicationStatus,
      action: item.action,
      taskStatus: item.taskStatus,
    }));
  }

  const profileSignals = [
    Boolean(profile?.full_name),
    Boolean(profile?.location),
    Array.isArray(profile?.skills) && profile.skills.length > 0,
    Number(profile?.experience_years ?? 0) > 0,
  ];
  const readiness = Math.round(profileSignals.filter(Boolean).length / profileSignals.length * 100);

  const operationApplications: CareerOperationApplication[] = (applications ?? []).map((application) => {
    const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const companies = (job as { companies?: unknown } | null | undefined)?.companies;
    const company = Array.isArray(companies) ? String((companies[0] as { name?: string | null } | undefined)?.name ?? "") : String((companies as { name?: string | null } | null | undefined)?.name ?? "");
    return {
      id: application.id,
      status: application.status,
      created_at: application.created_at,
      updated_at: application.updated_at,
      job: { title: job?.title, application_url: job?.application_url, company: company ?? null },
    };
  });

  const operations = buildCareerOperations({
    applications: operationApplications,
    actions: (actions ?? []) as CareerOperationAction[],
    opportunities,
    profile: { readiness },
    limit: 12,
  });

  return NextResponse.json({
    operations,
    counts: {
      total: operations.length,
      urgent: operations.filter((item) => item.priority === "urgent").length,
      approvalRequired: operations.filter((item) => item.requiresApproval).length,
    },
    readiness,
    targetRole: career?.target_roles?.[0] ?? null,
  });
}
