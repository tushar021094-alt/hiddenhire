import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildOpportunityMemory, type OpportunityMemoryEvent } from "@/lib/opportunity-memory";
import { decideOpportunityAction, type CareerDecisionAction } from "@/lib/career-decision";
import { classifyJobFunction } from "@/lib/match-engine";
import { buildApplicationPreparation } from "@/lib/application-preparation";

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
  const strategyId = typeof value.strategyId === "string" ? value.strategyId.trim().slice(0, 64) : null;
  const strategyChanges = value.strategyChanges && typeof value.strategyChanges === "object" && !Array.isArray(value.strategyChanges) ? value.strategyChanges : null;
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

  const workflow = requestedAction === "apply_now"
    ? {
        type: "application_handoff",
        title: `Apply to ${opportunity.title}`,
        message: "Open the verified application page, review the role details, submit the application yourself, then return to HiddenHire so the outcome can be tracked.",
        checklist: [
          "Review the job description and confirm the role still matches your target.",
          "Use your tailored resume and supporting materials.",
          "Submit the application on the employer or application-provider site.",
          "Return to HiddenHire and keep the application status updated.",
        ],
      }
    : requestedAction === "follow_up"
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

  let applicationPreparation: ReturnType<typeof buildApplicationPreparation> | null = null;
  if (requestedAction === "apply_now") {
    const latestEventPayload = (events[0]?.payload && typeof events[0].payload === "object" && !Array.isArray(events[0].payload))
      ? events[0].payload as Record<string, unknown>
      : {};
    const { data: profile } = await supabase
      .from("profiles")
      .select("skills,experience_years,country")
      .eq("id", user.id)
      .maybeSingle();
    const { data: career } = await supabase
      .from("candidate_profiles")
      .select("target_roles,headline")
      .eq("profile_id", user.id)
      .maybeSingle();
    applicationPreparation = buildApplicationPreparation({
      targetRole: opportunity.title,
      company: opportunity.company,
      location: opportunity.location,
      candidate: {
        headline: career?.headline,
        targetRole: career?.target_roles?.[0],
        experienceYears: profile?.experience_years,
        skills: Array.isArray(profile?.skills) ? profile.skills.filter((value): value is string => typeof value === "string") : [],
        country: profile?.country,
      },
      job: {
        description: typeof latestEventPayload.description === "string" ? latestEventPayload.description : null,
        requiredSkills: Array.isArray(latestEventPayload.requiredSkills)
          ? latestEventPayload.requiredSkills.filter((value): value is string => typeof value === "string")
          : [],
        requiredExperience: typeof latestEventPayload.requiredExperience === "number" ? latestEventPayload.requiredExperience : null,
        industry: typeof latestEventPayload.industry === "string" ? latestEventPayload.industry : null,
        source: typeof latestEventPayload.source === "string" ? latestEventPayload.source : null,
      },
    });
  }

  const { error: actionError } = await supabase.from("career_agent_actions").upsert({
    candidate_id: user.id, job_fingerprint: jobFingerprint, action: requestedAction,
    decision_score: opportunity.latestScore, source_url: opportunity.applicationUrl,
    job_title: opportunity.title, company_name: opportunity.company, job_location: opportunity.location,
    source_provider: (() => { try { return new URL(opportunity.applicationUrl).hostname.replace(/^www\\./, ""); } catch { return null; } })(),
    is_remote: /remote/i.test(opportunity.location),
    job_function: classifyJobFunction(opportunity.title),
    strategy_id: strategyId,
    strategy_changes: strategyChanges,
    workflow: requestedAction === "apply_now" ? { ...workflow, preparation: applicationPreparation } : workflow, task_status: "open", completed_at: null, last_evaluated_at: new Date().toISOString(),
  }, { onConflict: "candidate_id,job_fingerprint,action", ignoreDuplicates: true });

  if (actionError) return NextResponse.json({ error: "Unable to record this action." }, { status: 500 });

  const notificationText: Record<Exclude<CareerDecisionAction, "ignore">, { title: string; body: string }> = {
    apply_now: { title: "Application ready", body: `Apply to ${opportunity.title} at ${opportunity.company}; HiddenHire will track the outcome after submission.` },
    review: { title: "Opportunity ready for review", body: `${opportunity.title} at ${opportunity.company} is a strong match worth reviewing.` },
    prepare: { title: "Interview preparation", body: `Prepare for your active interview opportunity: ${opportunity.title} at ${opportunity.company}.` },
    follow_up: { title: "Application follow-up", body: `Your application for ${opportunity.title} at ${opportunity.company} is ready for follow-up.` },
    watch: { title: "Opportunity added to watch", body: `Keep watching ${opportunity.title} at ${opportunity.company} for a stronger signal.` },
  };
  const note = notificationText[requestedAction as Exclude<CareerDecisionAction, "ignore">];
  const { error: notificationError } = await supabase.from("notifications").insert({
    profile_id: user.id, type: `career_agent_${requestedAction}`, title: note.title, body: note.body,
    data: { jobFingerprint, applicationUrl: opportunity.applicationUrl, action: requestedAction },
  });
  if (notificationError) return NextResponse.json({ error: "Action recorded, but notification could not be created." }, { status: 500 });

  if (requestedAction === "apply_now") {
    return NextResponse.json({
      success: true,
      action: requestedAction,
      nextStep: "open_application",
      applicationUrl: opportunity.applicationUrl,
      decision,
      workflow,
    });
  }

  const nextStep = workflow?.type === "application_handoff"
    ? "open_application"
    : workflow?.type === "interview_prep"
      ? "interview_prep"
      : workflow?.type === "follow_up"
        ? "follow_up"
        : requestedAction === "review"
          ? "review"
          : "watch";

  return NextResponse.json({
    success: true,
    action: requestedAction,
    nextStep,
    applicationUrl: nextStep === "open_application" ? opportunity.applicationUrl : undefined,
    decision,
    workflow,
  });
}
