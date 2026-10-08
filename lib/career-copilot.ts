import type { MatchResult } from "@/lib/job-types";
import type { ProactiveCareerPlan } from "@/lib/proactive-career-agent";

export type CareerCopilotInput = {
  matches: MatchResult[];
  applications: Array<{
    status: string;
    created_at: string;
    title?: string | null;
    company?: string | null;
  }>;
  plan?: ProactiveCareerPlan | null;
  actionableOpportunityCount?: number;
  profileReadiness?: number;
};

export type CareerCopilot = {
  headline: string;
  situation: "act_now" | "prepare" | "follow_up" | "improve" | "monitor";
  confidence: "high" | "medium" | "low";
  summary: string;
  priority: {
    title: string;
    reason: string;
    action: string;
    urgency: "high" | "medium" | "low";
  } | null;
  blockers: string[];
  signals: string[];
  nextSteps: string[];
};

function ageInDays(value: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 86_400_000));
}

export function buildCareerCopilot(input: CareerCopilotInput, now = Date.now()): CareerCopilot {
  const interviews = input.applications.filter((item) => item.status === "interview");
  const followUps = input.applications.filter(
    (item) => item.status === "applied" && ageInDays(item.created_at, now) >= 5,
  );
  const strongMatches = input.matches.filter((item) => item.score >= 80);
  const planItem = input.plan?.primary ?? null;
  const readiness = input.profileReadiness ?? 100;
  const blockers: string[] = [];
  const signals: string[] = [];

  if (interviews.length) {
    const interview = interviews[0];
    const title = interview.title || "your active interview";
    const company = interview.company || "the company";
    signals.push(`Active interview: ${title} at ${company}.`);
    return {
      headline: "Prepare before you do anything else.",
      situation: "prepare",
      confidence: "high",
      summary: `You have ${interviews.length} active interview${interviews.length === 1 ? "" : "s"}. The highest-value move is preparation, not adding more applications.`,
      priority: {
        title: `Prepare for ${title}`,
        reason: "An active interview is the strongest near-term career signal.",
        action: "Open interview preparation and build your role-specific stories and questions.",
        urgency: "high",
      },
      blockers: [],
      signals,
      nextSteps: [
        "Prepare a concise introduction tailored to the role.",
        "Build three evidence-based STAR stories.",
        "Review the company, role requirements, and likely interview questions.",
      ],
    };
  }

  if (followUps.length) {
    const followUp = followUps[0];
    const age = ageInDays(followUp.created_at, now);
    const company = followUp.company || "the company";
    signals.push(`Application has been open for ${age} days without a closed outcome.`);
    return {
      headline: "Follow up before adding more noise.",
      situation: "follow_up",
      confidence: "high",
      summary: `You have ${followUps.length} application${followUps.length === 1 ? "" : "s"} that may be ready for a follow-up. Re-engaging an existing opportunity is currently more actionable than blindly expanding the pipeline.`,
      priority: {
        title: `Follow up with ${company}`,
        reason: `${age} days have passed without a recorded progression.`,
        action: "Queue a follow-up for approval and use the existing application context.",
        urgency: age >= 10 ? "high" : "medium",
      },
      blockers: [],
      signals,
      nextSteps: [
        "Review the latest application status.",
        "Prepare one concise, role-specific follow-up.",
        "Wait for a response before sending another reminder.",
      ],
    };
  }

  if (planItem && planItem.action !== "watch") {
    signals.push(planItem.whyNow);
    if (input.actionableOpportunityCount) {
      signals.push(`${input.actionableOpportunityCount} opportunity signal${input.actionableOpportunityCount === 1 ? "" : "s"} currently need attention.`);
    }
    return {
      headline: "You have a live opportunity worth acting on.",
      situation: "act_now",
      confidence: planItem.confidence >= 90 ? "high" : "medium",
      summary: `${planItem.title} at ${planItem.company} is currently the strongest next move in your opportunity set.`,
      priority: {
        title: planItem.title,
        reason: planItem.whyNow,
        action: planItem.nextStep,
        urgency: planItem.urgency,
      },
      blockers: planItem.action === "apply_now" ? ["Application still requires your final review and submission."] : [],
      signals,
      nextSteps: [
        planItem.nextStep,
        "Check the job authenticity and safety signals before proceeding.",
        "Record the outcome so HiddenHire can improve future recommendations.",
      ],
    };
  }

  if (readiness < 85) {
    blockers.push(`Profile readiness is ${readiness}%; incomplete profile signals can reduce matching precision.`);
    return {
      headline: "Strengthen your profile signal.",
      situation: "improve",
      confidence: "medium",
      summary: "There is not a strong enough live opportunity signal to justify aggressive action yet. Improving the profile should increase the quality of the next scan.",
      priority: {
        title: "Improve profile readiness",
        reason: "Profile gaps reduce the precision of matching and personalization.",
        action: "Complete the highest-value missing profile fields before the next scan.",
        urgency: readiness < 70 ? "high" : "medium",
      },
      blockers,
      signals: strongMatches.length ? [`${strongMatches.length} strong match${strongMatches.length === 1 ? "" : "es"} are available, but no higher-priority action is active.`] : [],
      nextSteps: [
        "Complete missing headline, skills, experience, and target-role signals.",
        "Run another opportunity scan.",
        "Use the strategy optimizer only after the baseline profile is accurate.",
      ],
    };
  }

  return {
    headline: "Keep monitoring; no forced action is justified.",
    situation: "monitor",
    confidence: "medium",
    summary: strongMatches.length
      ? `${strongMatches.length} strong match${strongMatches.length === 1 ? "" : "es"} exist, but there is no application or follow-up signal that currently outranks deliberate review.`
      : "The current opportunity set does not contain a sufficiently strong next move.",
    priority: null,
    blockers: [],
    signals: [
      `${input.matches.length} opportunity${input.matches.length === 1 ? "" : "ies"} scanned.`,
      `${strongMatches.length} strong match${strongMatches.length === 1 ? "" : "es"} at 80%+.`,
    ],
    nextSteps: [
      "Keep the opportunity stream active.",
      "Review new high-confidence matches as they appear.",
      "Let outcome data improve future prioritization.",
    ],
  };
}
