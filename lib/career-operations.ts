export type CareerOperationKind =
  | "interview_prepare"
  | "application_follow_up"
  | "application_check"
  | "opportunity_review"
  | "profile_improvement";

export type CareerOperationPriority = "urgent" | "high" | "medium" | "low";

export type CareerOperation = {
  id: string;
  kind: CareerOperationKind;
  priority: CareerOperationPriority;
  title: string;
  summary: string;
  reason: string;
  dueAt: string | null;
  jobFingerprint: string | null;
  action: string | null;
  applicationUrl: string | null;
  company: string | null;
  role: string | null;
  status: "open";
  requiresApproval: boolean;
  route: string;
};

export type CareerOperationApplication = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  job?: {
    title?: string | null;
    application_url?: string | null;
    company?: string | null;
  } | null;
};

export type CareerOperationAction = {
  id: string;
  job_fingerprint: string;
  action: string;
  task_status: string;
  due_at?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  source_url?: string | null;
};

export type CareerOperationOpportunity = {
  jobFingerprint: string;
  title: string;
  company: string;
  applicationUrl: string;
  priority: "act_now" | "review" | "watch" | "ignore";
  attentionScore: number;
  applicationStatus: string | null;
  action: string | null;
  taskStatus: string | null;
};

export type CareerOperationProfile = { readiness: number };

const TERMINAL = new Set(["rejected", "withdrawn", "hired"]);

function daysSince(value: string, nowMs: number) {
  return Math.max(0, (nowMs - new Date(value).getTime()) / 86_400_000);
}

function priorityFor(days: number): CareerOperationPriority {
  if (days >= 10) return "urgent";
  if (days >= 7) return "high";
  return "medium";
}

export function buildCareerOperations(input: {
  applications: CareerOperationApplication[];
  actions?: CareerOperationAction[];
  opportunities?: CareerOperationOpportunity[];
  profile?: CareerOperationProfile;
  now?: string;
  limit?: number;
}): CareerOperation[] {
  const nowMs = new Date(input.now ?? new Date().toISOString()).getTime();
  const operations: CareerOperation[] = [];
  const actionByUrl = new Map<string, CareerOperationAction>();

  for (const action of input.actions ?? []) {
    if (action.task_status !== "open") continue;
    if (action.source_url) actionByUrl.set(action.source_url.replace(/\/$/, "").toLowerCase(), action);
  }

  for (const application of input.applications) {
    const status = application.status.toLowerCase();
    const job = application.job;
    const role = job?.title ?? "Application";
    const company = job?.company ?? "Company";
    const url = job?.application_url ?? null;
    const age = daysSince(application.created_at, nowMs);
    const linkedAction = url ? actionByUrl.get(url.replace(/\/$/, "").toLowerCase()) : undefined;

    if (status === "interview") {
      operations.push({
        id: `interview:${application.id}`, kind: "interview_prepare", priority: "urgent",
        title: `Prepare for ${role}`,
        summary: `${company} is now an active interview. Build your preparation plan before the conversation.`,
        reason: "Interview status detected in your application pipeline.",
        dueAt: new Date(nowMs).toISOString(), jobFingerprint: linkedAction?.job_fingerprint ?? null,
        action: linkedAction?.action ?? "prepare", applicationUrl: url, company, role, status: "open",
        requiresApproval: false, route: "/applications",
      });
      continue;
    }

    if (status === "shortlisted") {
      operations.push({
        id: `shortlisted:${application.id}`, kind: "application_check", priority: "high",
        title: `Move ${role} forward`,
        summary: `${company} has shortlisted you. Review the latest communication and prepare for the next step.`,
        reason: "Shortlisted applications should be acted on before routine follow-ups.",
        dueAt: new Date(nowMs).toISOString(), jobFingerprint: linkedAction?.job_fingerprint ?? null,
        action: linkedAction?.action ?? "review", applicationUrl: url, company, role, status: "open",
        requiresApproval: false, route: "/applications",
      });
      continue;
    }

    if (status === "applied" && age >= 5) {
      operations.push({
        id: `follow-up:${application.id}`, kind: "application_follow_up", priority: priorityFor(age),
        title: `Follow up with ${company}`,
        summary: `Your ${role} application has been open for ${Math.floor(age)} days without a recorded progression.`,
        reason: age >= 10 ? "No application progression for 10+ days." : "Five or more days have passed since the application.",
        dueAt: new Date(nowMs).toISOString(), jobFingerprint: linkedAction?.job_fingerprint ?? null,
        action: linkedAction?.action ?? "follow_up", applicationUrl: url, company, role, status: "open",
        requiresApproval: true, route: "/applications",
      });
    }
  }

  for (const opportunity of input.opportunities ?? []) {
    if (opportunity.priority === "ignore") continue;
    if (opportunity.applicationStatus && TERMINAL.has(opportunity.applicationStatus)) continue;
    if (opportunity.action && opportunity.taskStatus === "open") continue;

    const priority: CareerOperationPriority =
      opportunity.priority === "act_now" ? "urgent" :
      opportunity.priority === "review" ? "high" : "medium";

    operations.push({
      id: `opportunity:${opportunity.jobFingerprint}`, kind: "opportunity_review", priority,
      title: priority === "urgent" ? `Act on ${opportunity.title}` : `Review ${opportunity.title}`,
      summary: `${opportunity.company} is scoring ${opportunity.attentionScore}/100 for your career pipeline.`,
      reason: opportunity.priority === "act_now"
        ? "High attention score and current opportunity signal."
        : "The opportunity is relevant enough to deserve a deliberate review.",
      dueAt: new Date(nowMs).toISOString(), jobFingerprint: opportunity.jobFingerprint,
      action: opportunity.action ?? null, applicationUrl: opportunity.applicationUrl,
      company: opportunity.company, role: opportunity.title, status: "open",
      requiresApproval: true, route: "/jobs",
    });
  }

  if ((input.profile?.readiness ?? 100) < 100) {
    operations.push({
      id: "profile:improve", kind: "profile_improvement",
      priority: (input.profile?.readiness ?? 0) < 75 ? "high" : "low",
      title: "Strengthen your career signal",
      summary: `Your profile is ${input.profile?.readiness ?? 0}% complete. Close the highest-value gaps before the next scan.`,
      reason: "Incomplete profile signals reduce matching and personalization precision.",
      dueAt: new Date(nowMs).toISOString(), jobFingerprint: null, action: null,
      applicationUrl: null, company: null, role: null, status: "open",
      requiresApproval: false, route: "/profile",
    });
  }

  const rank: Record<CareerOperationPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  return operations
    .sort((a, b) => rank[b.priority] - rank[a.priority] || a.title.localeCompare(b.title))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, input.limit ?? 12);
}
