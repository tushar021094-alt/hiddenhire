import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildOpportunityMemory, type OpportunityMemoryEvent } from "@/lib/opportunity-memory";
import { decideOpportunityAction } from "@/lib/career-decision";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data: watches, error: watchError } = await supabase.from("job_watches").select("id").eq("candidate_id", user.id);
  if (watchError) return NextResponse.json({ error: "Unable to load decisions." }, { status: 500 });
  if (!watches?.length) return NextResponse.json({ decisions: [] });

  const ids = watches.map((watch) => watch.id);
  const { data: events, error } = await supabase
    .from("job_watch_events")
    .select("id,watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
    .in("watch_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Unable to load opportunity decisions." }, { status: 500 });

  const opportunities = buildOpportunityMemory((events ?? []) as OpportunityMemoryEvent[]);
  const fingerprints = opportunities.map((item) => item.jobFingerprint);
  const { data: applications } = fingerprints.length
    ? await supabase
        .from("applications")
        .select("status,jobs(application_url)")
        .eq("candidate_id", user.id)
        .limit(100)
    : { data: [] };

  const appliedUrls = new Set<string>();
  for (const application of applications ?? []) {
    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    if (typeof jobs?.application_url === "string") appliedUrls.add(jobs.application_url.replace(/\/$/, "").toLowerCase());
  }

  const decisions = opportunities.map((opportunity) => {
    const alreadyApplied = appliedUrls.has(opportunity.applicationUrl.replace(/\/$/, "").toLowerCase());
    return { ...opportunity, decision: decideOpportunityAction(opportunity, { alreadyApplied }) };
  }).filter((item) => item.decision.action !== "ignore").slice(0, 30);

  return NextResponse.json({ decisions });
}
