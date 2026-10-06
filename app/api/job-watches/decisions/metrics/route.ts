import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildLearningInsights } from "@/lib/career-learning";
import { buildAttributionInsights } from "@/lib/career-learning-attribution";
import { calibrateScore } from "@/lib/career-score-calibration";
import { buildCareerAgentEffectiveness, buildCareerAgentEffectivenessPolicy } from "@/lib/career-agent-effectiveness";
import { buildOutcomeIntelligence } from "@/lib/career-outcome-intelligence";

const OUTCOMES = ["not_started","opened","applied","reviewing","shortlisted","interview","hired","rejected","withdrawn"] as const;

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { data: actions, error } = await supabase
    .from("career_agent_actions")
    .select("id,action,source_url,job_title,job_location,source_provider,job_function,is_remote,task_status,outcome,outcome_at,created_at,decision_score")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: "Unable to load Career Agent outcome metrics." }, { status: 500 });

  const { data: applications } = await supabase
    .from("applications")
    .select("status,jobs(application_url)")
    .eq("candidate_id", user.id)
    .limit(500);

  const normalize = (value: unknown) => typeof value === "string" ? value.replace(/\/$/, "").toLowerCase() : "";
  const applicationByUrl = new Map<string, string>();
  for (const application of applications ?? []) {
    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const url = normalize(jobs?.application_url);
    if (url) applicationByUrl.set(url, application.status);
  }

  const learningObservations = (actions ?? []).filter((action) => OUTCOMES.includes((applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started") as typeof OUTCOMES[number])).map((action) => ({ action: action.action, decisionScore: Number(action.decision_score || 0), outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started" }));
  const learning = buildLearningInsights(learningObservations);
  const effectiveness = buildCareerAgentEffectiveness((actions ?? []).map((action) => ({ action: action.action, taskStatus: action.task_status, outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started" })));
  const effectivenessPolicy = buildCareerAgentEffectivenessPolicy(effectiveness);
  const calibration = calibrateScore((actions ?? []).map((action) => ({ score: Number(action.decision_score || 0), outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started" })).filter((item) => item.outcome !== "not_started")));
  const attribution = buildAttributionInsights((actions ?? []).map((action) => ({
    action: action.action,
    decisionScore: Number(action.decision_score || 0),
    outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started",
    source: action.source_provider || "unknown",
    role: action.job_function || action.job_title || "unknown",
    remote: Boolean(action.is_remote ?? /remote/i.test(action.job_location || "")),
  })));

  const outcomeIntelligence = buildOutcomeIntelligence((actions ?? []).map((action) => ({
    action: action.action,
    score: Number(action.decision_score || 0),
    outcome: applicationByUrl.get(normalize(action.source_url)) || action.outcome || "not_started",
    source: action.source_provider || "unknown",
    role: action.job_function || action.job_title || "unknown",
    remote: Boolean(action.is_remote ?? /remote/i.test(action.job_location || "")),
    createdAt: action.created_at,
    outcomeAt: action.outcome_at,
  })));

  const outcomeCounts = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<string, number>;
  const actionCounts: Record<string, number> = {};
  const conversionByAction: Record<string, { actions: number; applied: number; interviews: number; hired: number }> = {};

  for (const action of actions ?? []) {
    const applicationStatus = applicationByUrl.get(normalize(action.source_url));
    const outcome = applicationStatus || action.outcome || "not_started";
    outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    actionCounts[action.action] = (actionCounts[action.action] || 0) + 1;
    const bucket = conversionByAction[action.action] ||= { actions: 0, applied: 0, interviews: 0, hired: 0 };
    bucket.actions += 1;
    if (["applied","reviewing","shortlisted","interview","hired"].includes(outcome)) bucket.applied += 1;
    if (["interview","hired"].includes(outcome)) bucket.interviews += 1;
    if (outcome === "hired") bucket.hired += 1;
  }

  const total = actions?.length ?? 0;
  const applicationsCreated = [...applicationByUrl.values()].length;
  const interviews = [...applicationByUrl.values()].filter((status) => status === "interview" || status === "hired").length;
  const hires = [...applicationByUrl.values()].filter((status) => status === "hired").length;

  return NextResponse.json({
    totals: {
      actions: total,
      applications: applicationsCreated,
      interviews,
      hires,
      application_conversion_rate: total ? Math.round((applicationsCreated / total) * 100) : 0,
      interview_conversion_rate: applicationsCreated ? Math.round((interviews / applicationsCreated) * 100) : 0,
      hire_conversion_rate: applicationsCreated ? Math.round((hires / applicationsCreated) * 100) : 0,
    },
    outcomes: outcomeCounts,
    actions_by_type: actionCounts,
    conversion_by_action: conversionByAction,
    learning,
    effectiveness,
    effectivenessPolicy,
    attribution,
    calibration,
    outcomeIntelligence,
  });
}
