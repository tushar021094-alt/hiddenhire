import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildOpportunityMemory, type OpportunityMemoryEvent } from "@/lib/opportunity-memory";
import { decideOpportunityAction, type CareerDecisionAction } from "@/lib/career-decision";

const ACTIONS = new Set<CareerDecisionAction>(["apply_now", "review", "prepare", "follow_up", "watch"]);

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "A decision payload is required." }, { status: 400 });

  const value = body as Record<string, unknown>;
  const jobFingerprint = typeof value.jobFingerprint === "string" ? value.jobFingerprint.trim() : "";
  const requestedAction = typeof value.action === "string" ? value.action.trim() as CareerDecisionAction : null;
  if (!jobFingerprint || !requestedAction || !ACTIONS.has(requestedAction)) {
    return NextResponse.json({ error: "jobFingerprint and a valid action are required." }, { status: 400 });
  }

  const { data: watches, error: watchError } = await supabase.from("job_watches").select("id").eq("candidate_id", user.id);
  if (watchError) return NextResponse.json({ error: "Unable to verify the opportunity." }, { status: 500 });
  const ids = (watches ?? []).map((watch) => watch.id);
  if (!ids.length) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const { data: events, error: eventError } = await supabase
    .from("job_watch_events")
    .select("id,watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
    .in("watch_id", ids).eq("job_fingerprint", jobFingerprint)
    .order("created_at", { ascending: false }).limit(100);
  if (eventError || !events?.length) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const opportunity = buildOpportunityMemory(events as OpportunityMemoryEvent[])[0];
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const normalize = (v: unknown) => typeof v === "string" ? v.replace(/\/$/, "").toLowerCase() : "";
  const { data: applications } = await supabase.from("applications").select("status,jobs(application_url)").eq("candidate_id", user.id).limit(100);
  let applicationStatus: string | undefined;
  for (const application of applications ?? []) {
    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    if (normalize(jobs?.application_url) === normalize(opportunity.applicationUrl)) { applicationStatus = application.status; break; }
  }

  const decision = decideOpportunityAction(opportunity, { application: { status: applicationStatus }, alreadyApplied: Boolean(applicationStatus) });
  if (decision.action !== requestedAction) {
    return NextResponse.json({ error: "This recommendation has changed. Refresh the Career Agent before taking this action.", currentDecision: decision }, { status: 409 });
  }

  if (requestedAction === "apply_now") {
    return NextResponse.json({ success: true, action: requestedAction, nextStep: "open_application", applicationUrl: opportunity.applicationUrl, decision });
  }

  const workflow = requestedAction === "follow_up"
    ? {
        type: "follow_up",
        title: `Follow up with ${opportunity.company}`,
        message: `Hi, I’m following up on my application for the ${opportunity.title} role. I remain very interested in the opportunity and would be happy to provide any additional information. Thank you for your consideration.`,
        timing: applicationStatus === "shortlisted" ? "Follow up today." : "Follow up now, then wait 3–5 business days before another check-in.",
      }
    : requestedAction === "prepare"
      ? {
          type: "interview_prep",
          title: `Prepare for ${opportunity.title}`,
          checklist: [
            "Review the role requirements and map your strongest experience to each requirement.",
            "Prepare a concise 60-second introduction focused on measurable results.",
            "Prepare 3 STAR examples covering ownership, problem-solving, and measurable impact.",
            "Prepare 3 role-specific questions to ask the interviewer.",
          ],
        }
      : null;

  const { data: openActions, error: openActionError } = await supabase
    .from("career_agent_actions")
    .select("id,action")
    .eq("candidate_id", user.id)
    .eq("job_fingerprint", jobFingerprint)
    .eq("task_status", "open");
  if (openActionError) return NextResponse.json({ error: "Unable to reconcile existing Career Agent actions." }, { status: 500 });

  const supersededIds = (openActions ?? [])
    .filter((item) => item.action !== requestedAction)
    .map((item) => item.id);
  if (supersededIds.length) {
    const { error: supersedeError } = await supabase
      .from("career_agent_actions")
      .update({ task_status: "dismissed", completed_at: null, last_evaluated_at: new Date().toISOString() })
      .in("id", supersededIds)
      .eq("candidate_id", user.id);
    if (supersedeError) return NextResponse.json({ error: "Unable to supersede the previous recommendation." }, { status: 500 });
  }

  const { error: actionError } = await supabase.from("career_agent_actions").upsert({
    candidate_id: user.id, job_fingerprint: jobFingerprint, action: requestedAction,
    decision_score: opportunity.latestScore, source_url: opportunity.applicationUrl,
    job_title: opportunity.title, company_name: opportunity.company, job_location: opportunity.location,
    workflow, task_status: "open", completed_at: null, last_evaluated_at: new Date().toISOString(),
  }, { onConflict: "candidate_id,job_fingerprint,action", ignoreDuplicates: true });

  if (actionError) return NextResponse.json({ error: "Unable to record this action." }, { status: 500 });

  const notificationText: Record<Exclude<CareerDecisionAction, "apply_now" | "ignore">, { title: string; body: string }> = {
    review: { title: "Opportunity ready for review", body: `${opportunity.title} at ${opportunity.company} is a strong match worth reviewing.` },
    prepare: { title: "Interview preparation", body: `Prepare for your active interview opportunity: ${opportunity.title} at ${opportunity.company}.` },
    follow_up: { title: "Application follow-up", body: `Your application for ${opportunity.title} at ${opportunity.company} is ready for follow-up.` },
    watch: { title: "Opportunity added to watch", body: `Keep watching ${opportunity.title} at ${opportunity.company} for a stronger signal.` },
  };
  const note = notificationText[requestedAction as Exclude<CareerDecisionAction, "apply_now" | "ignore">];
  const { error: notificationError } = await supabase.from("notifications").insert({
    profile_id: user.id, type: `career_agent_${requestedAction}`, title: note.title, body: note.body,
    data: { jobFingerprint, applicationUrl: opportunity.applicationUrl, action: requestedAction },
  });
  if (notificationError) return NextResponse.json({ error: "Action recorded, but notification could not be created." }, { status: 500 });

  return NextResponse.json({
    success: true,
    action: requestedAction,
    nextStep: requestedAction === "prepare" ? "interview_prep" : requestedAction === "follow_up" ? "follow_up" : requestedAction === "review" ? "review" : "watch",
    decision,
    workflow,
  });
}
