import type { MatchResult } from "@/lib/job-types";

export type ProactiveApplication = { status: string; created_at: string; title?: string | null; company?: string | null };
export type ProactiveAction = "prepare" | "follow_up" | "apply_now" | "review" | "watch" | "improve_profile";
export type ProactivePlanItem = { action: ProactiveAction; title: string; company: string; location: string; score: number; confidence: number; urgency: "high" | "medium" | "low"; whyNow: string; nextStep: string; applicationUrl: string };
export type ProactiveCareerPlan = { headline: string; summary: string; primary: ProactivePlanItem | null; items: ProactivePlanItem[]; scanState: "actionable" | "monitoring" | "profile_needed" };

function ageInDays(value: string, now: number) { return Math.max(0, Math.floor((now - new Date(value).getTime()) / 86400000)); }
function actionPriority(action: ProactiveAction) { return { prepare: 100, follow_up: 95, apply_now: 90, review: 72, watch: 35, improve_profile: 20 }[action]; }

function planForMatch(match: MatchResult, application?: ProactiveApplication, now = Date.now()): ProactivePlanItem {
  const score = Math.round(match.score);
  const job = match.job;
  if (application?.status === "interview") return { action: "prepare", title: job.title, company: job.company, location: job.location, score, confidence: 98, urgency: "high", whyNow: "You already have an active interview for this role.", nextStep: "Prepare a 60-second introduction, 3 STAR examples and role-specific questions.", applicationUrl: job.applicationUrl };
  if (application && ["applied", "reviewing", "shortlisted"].includes(application.status) && ageInDays(application.created_at, now) >= 5) return { action: "follow_up", title: job.title, company: job.company, location: job.location, score, confidence: score >= 80 ? 94 : 84, urgency: score >= 80 ? "high" : "medium", whyNow: "Your application has been active for " + ageInDays(application.created_at, now) + " days without a closed outcome.", nextStep: "Send one concise follow-up and wait 3–5 business days before another check-in.", applicationUrl: job.applicationUrl };
  if (score >= 85) return { action: "apply_now", title: job.title, company: job.company, location: job.location, score, confidence: 95, urgency: "high", whyNow: "This is a top-tier " + score + "% match across the current opportunity set.", nextStep: "Review the role, use tailored materials, then submit on the employer application page.", applicationUrl: job.applicationUrl };
  if (score >= 75) return { action: "review", title: job.title, company: job.company, location: job.location, score, confidence: 84, urgency: "medium", whyNow: "The role clears HiddenHire’s strong-match threshold at " + score + "%.", nextStep: "Review the requirements and decide whether the role is worth entering your application pipeline.", applicationUrl: job.applicationUrl };
  return { action: "watch", title: job.title, company: job.company, location: job.location, score, confidence: 74, urgency: "low", whyNow: "The current fit is " + score + "%, so the agent will watch for a stronger signal.", nextStep: "Keep watching; prioritize higher-confidence opportunities first.", applicationUrl: job.applicationUrl };
}

export function buildProactiveCareerPlan(matches: MatchResult[], applications: ProactiveApplication[], now = Date.now()): ProactiveCareerPlan {
  const ranked = matches.slice(0, 12).map((match, index) => {
    const application = applications.find((item) => item.title && item.title.toLowerCase() === match.job.title.toLowerCase() && (!item.company || item.company.toLowerCase() === match.job.company.toLowerCase()));
    return planForMatch(match, application, now);
  });
  const unique = new Map<string, ProactivePlanItem>();
  for (const item of ranked) {
    const key = item.company.toLowerCase() + "|" + item.title.toLowerCase();
    const existing = unique.get(key);
    if (!existing || actionPriority(item.action) > actionPriority(existing.action)) unique.set(key, item);
  }
  const items = [...unique.values()].sort((a, b) => actionPriority(b.action) - actionPriority(a.action) || b.confidence - a.confidence || b.score - a.score).slice(0, 3);
  if (!matches.length) return { headline: "Build a stronger opportunity signal", summary: "No live opportunities are ready for action yet. Complete the profile signals and run another scan.", primary: null, items: [], scanState: "profile_needed" };
  const primary = items[0] ?? null;
  return { headline: primary ? "Next best move: " + primary.action.replace("_", " ") : "Keep monitoring your opportunity stream", summary: primary ? primary.title + " at " + primary.company + " is currently the highest-value action in your opportunity set." : "The current market signal is below the action threshold; HiddenHire will keep monitoring for changes.", primary, items, scanState: items.some((item) => item.action !== "watch") ? "actionable" : "monitoring" };
}