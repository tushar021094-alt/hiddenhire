"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MatchResult } from "@/lib/job-types";
import type { CareerDecisionAction } from "@/lib/career-decision";
import CareerIntelligence from "@/components/career-intelligence";
import ProactiveCareerPlan from "@/components/proactive-career-plan";
import CareerSimulation from "@/components/career-simulation";
import CareerStrategyOptimizer from "@/components/career-strategy-optimizer";
import { personalizeMatch } from "@/lib/career-personalization";

type ApplicationSummary = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  jobs?: { title: string | null; companies?: Company } | { title: string | null; companies?: Company }[] | null;
};

type Company = { name: string | null } | { name: string | null }[] | null | undefined;

type DecisionItem = { jobFingerprint: string; title: string; company: string; location: string; applicationUrl: string; latestScore: number; decision: { action: CareerDecisionAction; confidence: number; reason: string; urgency: "high" | "medium" | "low" } };

type ApplicationPreparation = { professionalSummary?: string; coverLetter?: string; matchedSkills?: string[]; missingSkills?: string[]; experienceFit?: string; requirementChecklist?: string[]; jobDescriptionSnapshot?: string };

type LearningMetrics = {
  totals: { actions: number; applications: number; interviews: number; hires: number; application_conversion_rate: number; interview_conversion_rate: number; hire_conversion_rate: number };
  learning: Array<{ action: string; sampleSize: number; eligible: boolean; recommendation: "hold" | "increase" | "decrease"; scoreAdjustment: number; reason: string }>;
  calibration: { eligible: boolean; sampleSize: number; adjustment: number; overallPositiveRate?: number; highScorePositiveRate?: number; lowScorePositiveRate?: number; reason: string };
  effectiveness: { sampleSize: number; completed: number; dismissed: number; completionRate: number; dismissalRate: number; actions: Array<{ action: string; sampleSize: number; completed: number; dismissed: number; completionRate: number; dismissalRate: number; resolvedOutcomes: number; positiveOutcomeRate: number; interviewOrHireRate: number }> };
  effectivenessPolicy: { eligible: boolean; sampleSize: number; recommendations: Array<{ action: string; direction: "positive" | "negative"; delta: number; reason: string }> };
  outcomeIntelligence?: { summary: { resolved: number; positive: number; interviews: number; hires: number; rejected: number; withdrawn: number; positiveRate: number; interviewOrHireRate: number; hireRate: number; medianOutcomeDays: number | null }; breakdowns: Array<{ dimension: string; results: Array<{ group: string; sampleSize: number; positiveRate: number; interviewOrHireRate: number; hireRate: number }> }> };
  strategy?: { eligible: boolean; sampleSize: number; headline: string; recommendations: string[]; bottlenecks: string[] };
  strategyLearning: Array<{ strategyId: string; sampleSize: number; positiveRate: number; interviewOrHireRate: number; eligible: boolean; adjustment: number }> | null;
  personalization: { eligible: boolean; sampleSize: number; confidence: "low" | "medium" | "high"; headline: string; focus: string[] } | null;
  attribution: { dimensions: Array<{ dimension: string; results: Array<{ group: string; sampleSize: number; eligible: boolean; positiveRate: number; interviewOrHireRate: number }> }>; recommendations: Array<{ dimension: string; group: string; sampleSize: number; direction: "positive" | "negative"; delta: number; reason: string }>; policy: { eligible: boolean; sampleSize: number; boosts: Array<{ dimension: "role" | "source" | "remote" | "score_band"; group: string; points: number }>; penalties: Array<{ dimension: "role" | "source" | "remote" | "score_band"; group: string; points: number }> } };
};

type Props = {
  targetRoles: string[];
  preferredLocations: string[];
  location: string | null;
  skills: string[];
  yearsOfExperience: number;
  minimumSalary: number;
  remoteOnly: boolean;
  applications: ApplicationSummary[];
};

function companyName(company: Company) {
  if (Array.isArray(company)) return company[0]?.name || "Company";
  return company?.name || "Company";
}

function ageInDays(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export default function CareerAgent({ targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly, applications }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<{ type: string; title: string; message?: string; timing?: string; checklist?: string[]; preparation?: ApplicationPreparation | null } | null>(null);
  const [todayQueue, setTodayQueue] = useState<Array<{ id: string; action: CareerDecisionAction; job_title: string | null; company_name: string | null; decision_score: number; source_url: string; due_at: string | null; overdue: boolean; priority_score: number; queue_reason?: string; outcome?: string | null; job_fingerprint: string }>>([]);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<{ id: string; label: string; changes: Record<string, unknown> } | null>(null);
  const [actionHistory, setActionHistory] = useState<Array<{ id: string; job_fingerprint: string; action: CareerDecisionAction; decision_score: number; source_url: string; job_title: string | null; company_name: string | null; job_location: string | null; workflow: { type: string; title: string; message?: string; timing?: string; checklist?: string[]; preparation?: ApplicationPreparation | null } | null; task_status: "open" | "completed" | "dismissed"; effective_status: "open" | "completed" | "dismissed"; application_status: string | null; completed_at: string | null; due_at: string | null; last_reminded_at: string | null; outcome: string | null; outcome_at: string | null; outcome_source: string | null; created_at: string }>>([]);

  const personalizedMatches = useMemo(() => { if (!learningMetrics?.attribution?.policy) return matches; return matches.map((match) => personalizeMatch(match, learningMetrics.attribution.policy)).sort((a, b) => (b.personalizedScore ?? b.score) - (a.personalizedScore ?? a.score)); }, [matches, learningMetrics?.attribution?.policy]);

  const activeApplications = useMemo(
    () => applications.filter((item) => !["rejected", "withdrawn", "hired"].includes(item.status)),
    [applications],
  );

  const followUps = useMemo(
    () => activeApplications.filter((item) => item.status === "applied" && ageInDays(item.created_at) >= 5),
    [activeApplications],
  );

  const interviews = useMemo(
    () => applications.filter((item) => item.status === "interview"),
    [applications],
  );

  async function scan() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetJobTitle: targetRoles[0] || "Finance Manager",
          targetRoles,
          yearsOfExperience,
          minimumSalary,
          preferredCurrency: "INR",
          preferredCountries: ["India"],
          preferredLocations: preferredLocations.length ? preferredLocations : (location ? [location] : ["Delhi NCR"]),
          remoteOnly,
          preferredIndustries: [],
          skills,
          keySkills: skills,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Agent scan failed.");
      setMatches(Array.isArray(payload?.results) ? payload.results : []);
      setLastScan(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      const decisionResponse = await fetch("/api/job-watches/decisions");
      const decisionData = await decisionResponse.json();
      if (decisionResponse.ok) setDecisions(Array.isArray(decisionData.decisions) ? decisionData.decisions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent scan failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTodayQueue() { try { const response = await fetch("/api/job-watches/decisions/today"); const payload = await response.json(); if (response.ok && Array.isArray(payload?.items)) setTodayQueue(payload.items); } catch {} }

  async function refreshLearningMetrics() {
    try {
      const response = await fetch("/api/job-watches/decisions/metrics");
      const payload = await response.json();
      if (response.ok) setLearningMetrics(payload);
    } catch {}
  }

  async function updateTask(id: string, taskStatus: "open" | "completed" | "dismissed") {
    try {
      const response = await fetch("/api/job-watches/decisions/task", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, taskStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Task update failed.");
      setActionHistory((current) => current.map((item) => item.id === id ? { ...item, task_status: taskStatus, effective_status: taskStatus, completed_at: payload.task.completed_at } : item));
      setActionMessage(taskStatus === "completed" ? "Task completed." : taskStatus === "dismissed" ? "Task dismissed." : "Task reopened.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Task update failed.");
    }
  }

  async function executeDecision(item: DecisionItem) {
    const action = item.decision.action;
    if (action === "ignore") return;
    const key = item.jobFingerprint + action;
    setActionLoading(key);
    setActionMessage(null);
    setWorkflow(null);
    try {
      const response = await fetch("/api/job-watches/decisions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobFingerprint: item.jobFingerprint, action, strategyId: selectedStrategy?.id ?? null, strategyChanges: selectedStrategy?.changes ?? null }),
      });
      const payload = await response.json();
      if (response.status === 409 && payload?.decision) {
        setDecisions((current) => current.map((entry) => entry.applicationUrl === item.applicationUrl ? { ...entry, decision: payload.decision } : entry));
        throw new Error("This opportunity changed. The recommendation was refreshed.");
      }
      if (!response.ok) throw new Error(payload?.message || "Action could not be completed.");
      setActionMessage(payload?.nextStep ? "Done — next step: " + String(payload.nextStep).replace("_", " ") + "." : "Action recorded.");
      if (payload?.workflow) setWorkflow(payload.workflow);
      const historyResponse = await fetch("/api/job-watches/decisions/actions");
      const historyPayload = await historyResponse.json();
      if (historyResponse.ok && Array.isArray(historyPayload?.actions)) setActionHistory(historyPayload.actions);
      await refreshTodayQueue();
      await refreshLearningMetrics();
      if (payload?.nextStep === "open_application" && payload?.applicationUrl) window.open(payload.applicationUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Action could not be completed.");
    } finally {
      setActionLoading(null);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect -- server-backed queue refresh intentionally updates local state on mount */
  useEffect(() => {
    void refreshTodayQueue();
    void refreshLearningMetrics();
    void fetch("/api/job-watches/decisions/actions").then((response) => response.json()).then((data) => { if (Array.isArray(data?.actions)) { setActionHistory(data.actions); const latestWorkflow = data.actions.find((item: { workflow?: unknown; task_status?: string; effective_status?: string }) => item.workflow && item.effective_status === "open")?.workflow; if (latestWorkflow) setWorkflow(latestWorkflow); } }).catch(() => undefined);

    let cancelled = false;

    async function initialise() {
      try {
        const response = await fetch("/api/jobs/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetJobTitle: targetRoles[0] || "Finance Manager",
            targetRoles,
            yearsOfExperience,
            minimumSalary,
            preferredCurrency: "INR",
            preferredCountries: ["India"],
            preferredLocations: preferredLocations.length ? preferredLocations : (location ? [location] : ["Delhi NCR"]),
            remoteOnly,
            preferredIndustries: [],
            skills,
            keySkills: skills,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Agent scan failed.");
        if (!cancelled) {
          setMatches(Array.isArray(payload?.results) ? payload.results : []);
          setLastScan(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
          const decisionResponse = await fetch("/api/job-watches/decisions");
          const decisionData = await decisionResponse.json();
          if (decisionResponse.ok) setDecisions(Array.isArray(decisionData.decisions) ? decisionData.decisions : []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Agent scan failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialise();
    return () => {
      cancelled = true;
    };
  }, [targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const highMatches = matches.filter((item) => item.score >= 70).slice(0, 3);
  const nextAction =
    interviews.length > 0
      ? "Prepare for your active interview"
      : followUps.length > 0
        ? "Follow up on older applications"
        : highMatches.length > 0
          ? "Review new high-match opportunities"
          : "Refresh your profile and scan again";

  const careerIntelligenceProps = { targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly, matches };

  return (
    <>
      <CareerIntelligence {...careerIntelligenceProps} />
      <CareerSimulation {...careerIntelligenceProps} />
      <CareerStrategyOptimizer {...careerIntelligenceProps} strategySignals={learningMetrics?.strategyLearning ?? []} personalization={learningMetrics?.personalization ?? undefined} onStrategySelect={(id, changes, label) => setSelectedStrategy({ id, label, changes })} />
      <section className="career-agent-v2 mt-6 overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.06] via-white/[0.025] to-blue-500/[0.04]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Proactive Career Agent</p>
            <h2 className="mt-1 text-xl font-semibold">Your next best move</h2>
            <p className="mt-1 text-xs text-white/50">Live opportunity scan + application follow-up intelligence, without auto-submitting applications.</p>
          </div>
          <button type="button" onClick={() => void scan()} disabled={loading} className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">
            {loading ? "Scanning…" : "Scan opportunities"}
          </button>
        </div>
      </div>

      <ProactiveCareerPlan matches={matches} applications={applications.map((application) => { const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs; return { status: application.status, created_at: application.created_at, title: job?.title ?? null, company: companyName(job?.companies) }; })} probabilityEvidence={learningMetrics?.calibration ? { eligible: learningMetrics.calibration.eligible, sampleSize: learningMetrics.calibration.sampleSize, highScorePositiveRate: learningMetrics.calibration.highScorePositiveRate, overallPositiveRate: learningMetrics.calibration.overallPositiveRate } : undefined} />

      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Today</p><span className="text-[10px] text-white/30">{todayQueue.length} priority actions</span></div><div className="mt-3 space-y-2">{todayQueue.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2"><div className="min-w-0"><p className="truncate text-[10px] font-semibold">{item.action.replace("_", " ").toUpperCase()} · {item.job_title || "Opportunity"}</p><p className="truncate text-[9px] text-white/35">{item.company_name || "Company"} · {Math.round(Number(item.decision_score))}%{item.overdue ? " · DUE NOW" : ""}{item.queue_reason ? " · " + item.queue_reason : ""}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => { const decision = decisions.find((entry) => entry.jobFingerprint === item.job_fingerprint); if (decision) void executeDecision(decision); }} disabled={actionLoading !== null} className="text-[9px] font-semibold text-cyan-200/80">{item.action === "apply_now" ? "Apply" : item.action === "prepare" ? "Prepare" : item.action === "follow_up" ? "Follow up" : item.action === "review" ? "Review" : "Watch"}</button><a href={item.source_url} target="_blank" rel="noreferrer" className="text-[9px] text-white/40">Open</a></div></div>)}{!todayQueue.length && <p className="text-xs text-white/35">Nothing needs your attention right now.</p>}</div></div>

<div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Outcome Intelligence</p>
          {learningMetrics?.outcomeIntelligence && <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] text-white/35">Resolved</p><p className="mt-1 text-lg font-semibold">{learningMetrics.outcomeIntelligence.summary.resolved}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] text-white/35">Positive</p><p className="mt-1 text-lg font-semibold">{learningMetrics.outcomeIntelligence.summary.positiveRate}%</p></div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] text-white/35">Interview/Hire</p><p className="mt-1 text-lg font-semibold">{learningMetrics.outcomeIntelligence.summary.interviewOrHireRate}%</p></div>
            <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] text-white/35">Median outcome</p><p className="mt-1 text-lg font-semibold">{learningMetrics.outcomeIntelligence.summary.medianOutcomeDays === null ? "—" : learningMetrics.outcomeIntelligence.summary.medianOutcomeDays + "d"}</p></div>
          </div>}
        </div>
        {learningMetrics?.strategy && <div className="mb-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-200/80">Today&apos;s strategy</p>
              <p className="mt-1 text-xs font-semibold text-white/85">{learningMetrics.strategy.headline}</p>
            </div>
            <span className="shrink-0 text-[9px] text-white/35">{learningMetrics.strategy.sampleSize} resolved</span>
          </div>
          {!learningMetrics.strategy.eligible && <p className="mt-2 text-[9px] leading-4 text-white/40">Evidence gate: 30 resolved outcomes are required before targeted strategy changes are recommended.</p>}
          {learningMetrics.strategy.bottlenecks.length > 0 && <div className="mt-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-amber-200/70">Bottlenecks</p><div className="mt-1 space-y-1">{learningMetrics.strategy.bottlenecks.slice(0, 3).map((item) => <p key={item} className="text-[9px] leading-4 text-white/55">• {item}</p>)}</div></div>}
          {learningMetrics.strategy.recommendations.length > 0 && <div className="mt-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Recommendations</p><div className="mt-1 space-y-1">{learningMetrics.strategy.recommendations.slice(0, 3).map((item) => <p key={item} className="text-[9px] leading-4 text-white/55">• {item}</p>)}</div></div>}
        </div>}

        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Decision Engine</p>{selectedStrategy && <span className="rounded-md border border-violet-300/15 bg-violet-300/[.04] px-2 py-1 text-[9px] text-violet-200/80">Strategy active: {selectedStrategy.label}</span>}
          <span className="text-[10px] text-white/30">{decisions.length} recommended actions</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {workflow && <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
            <p className="text-[10px] font-semibold text-cyan-100">{workflow.title}</p>
            {workflow.message && <p className="mt-2 text-[10px] leading-5 text-white/65">{workflow.message}</p>}
            {workflow.timing && <p className="mt-2 text-[9px] text-cyan-100/60">{workflow.timing}</p>}
            {workflow.checklist && <ul className="mt-2 space-y-1 text-[10px] leading-5 text-white/60">{workflow.checklist.map((item) => <li key={item}>• {item}</li>)}</ul>}
            {workflow.preparation?.professionalSummary && <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] font-semibold uppercase tracking-[.15em] text-cyan-200/70">Tailored summary</p><p className="mt-2 text-[10px] leading-5 text-white/65">{workflow.preparation.professionalSummary}</p></div>}
            {workflow.preparation?.coverLetter && <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] font-semibold uppercase tracking-[.15em] text-cyan-200/70">Cover letter draft</p><p className="mt-2 whitespace-pre-line text-[10px] leading-5 text-white/65">{workflow.preparation.coverLetter}</p></div>}
          </div>}
          {actionMessage && <p className="mb-2 rounded-lg border border-cyan-300/10 bg-cyan-300/[0.03] p-2 text-[10px] text-cyan-100/80">{actionMessage}</p>}
          {decisions.slice(0, 6).map((item) => {
            const key = item.jobFingerprint + item.decision.action;
            return (
              <div key={item.applicationUrl} className="rounded-lg border border-white/10 bg-black/10 p-3 hover:border-cyan-300/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{item.title}</span>
                  <span className="shrink-0 text-[9px] font-bold text-cyan-200">{item.decision.action.replace("_", " ").toUpperCase()}</span>
                </div>
                <div className="mt-1 truncate text-[10px] text-white/40">{item.company} · {item.location} · {item.latestScore}%</div>
                <div className="mt-2 text-[9px] text-white/50">{item.decision.reason}</div>
                <div className="mt-2 text-[9px] text-cyan-100/60">Confidence {item.decision.confidence}% · {item.decision.urgency} urgency</div>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => void executeDecision(item)} disabled={actionLoading !== null} className="rounded-md bg-cyan-300/10 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100 disabled:opacity-50">
                    {actionLoading === key ? "Working…" : item.decision.action === "apply_now" ? "Apply now →" : item.decision.action.replace("_", " ").replace(/^./, (v) => v.toUpperCase())}
                  </button>
                  <a href={item.applicationUrl} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 hover:text-white/70">Open job</a>
                </div>
              </div>
            );
          })}
          {!decisions.length && <p className="py-4 text-xs text-white/35 md:col-span-2 xl:col-span-3">No decision-worthy opportunity yet. The agent will populate this after watch history builds.</p>}
        </div>
      </div>

      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Recent agent actions</p>
          <span className="text-[10px] text-white/30">{actionHistory.filter((item) => item.effective_status === "open").length} open</span>
        </div>
        <div className="mt-3 space-y-2">
          {actionHistory.filter((item) => item.effective_status === "open").slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold">{item.action.replace("_", " ").toUpperCase()}</p>
                <p className="truncate text-[9px] text-white/35">{item.job_title || item.job_fingerprint} · {item.company_name || "Company"} · {Math.round(Number(item.decision_score))}% · {item.effective_status}{item.application_status ? ` · application: ${item.application_status}` : ""}{item.outcome && item.outcome !== "not_started" ? ` · outcome: ${item.outcome}` : ""}{item.effective_status === "open" && item.due_at ? ` · due ${new Date(item.due_at).toLocaleDateString("en-IN")}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2"><a href={item.source_url} target="_blank" rel="noreferrer" className="text-[9px] text-cyan-200/60 hover:text-cyan-100">Open</a>{item.effective_status === "open" ? <button type="button" onClick={() => void updateTask(item.id, "completed")} className="text-[9px] text-emerald-200/70 hover:text-emerald-100">Done</button> : <button type="button" onClick={() => void updateTask(item.id, "open")} className="text-[9px] text-cyan-200/70 hover:text-cyan-100">Resume</button>}<span className="text-[9px] text-white/30">{new Date(item.created_at).toLocaleDateString("en-IN")}</span></div>
            </div>
          ))}
          {!actionHistory.length && <p className="text-xs text-white/35">No actions recorded yet.</p>}
        </div>
      </div>
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Agent Intelligence</p>
            <p className="mt-1 text-[10px] text-white/40">Outcome feedback is measured before it is allowed to change ranking.</p>
          </div>
          {learningMetrics && <span className="text-[10px] text-white/30">{learningMetrics.totals.actions} tracked actions</span>}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/35">Agent completion</p><p className="mt-1 text-lg font-semibold">{learningMetrics?.effectiveness.completionRate ?? 0}%</p><p className="text-[9px] text-white/35">{learningMetrics?.effectiveness.completed ?? 0} completed · {learningMetrics?.effectiveness.dismissed ?? 0} dismissed</p></div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/35">Applications</p><p className="mt-1 text-lg font-semibold">{learningMetrics?.totals.applications ?? 0}</p><p className="text-[9px] text-white/35">{learningMetrics?.totals.application_conversion_rate ?? 0}% conversion</p></div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/35">Interviews</p><p className="mt-1 text-lg font-semibold">{learningMetrics?.totals.interviews ?? 0}</p><p className="text-[9px] text-white/35">{learningMetrics?.totals.interview_conversion_rate ?? 0}% of applications</p></div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/35">Hires</p><p className="mt-1 text-lg font-semibold">{learningMetrics?.totals.hires ?? 0}</p><p className="text-[9px] text-white/35">{learningMetrics?.totals.hire_conversion_rate ?? 0}% of applications</p></div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/35">Calibration</p><p className="mt-1 text-lg font-semibold">{learningMetrics?.calibration.eligible ? (learningMetrics.calibration.adjustment > 0 ? "+" : "") + learningMetrics.calibration.adjustment : "HOLD"}</p><p className="text-[9px] text-white/35">{learningMetrics?.calibration.sampleSize ?? 0}/50 outcomes</p></div>
        </div>
        {learningMetrics && <p className="mt-3 text-[9px] leading-4 text-white/40">{learningMetrics.calibration.reason}</p>}
        {learningMetrics?.effectivenessPolicy?.recommendations?.length ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Action learning policy</p>
            <p className="mt-1 text-[10px] text-white/35">
              Evidence gate: {learningMetrics.effectivenessPolicy.sampleSize}/30 observations
            </p>
            <div className="mt-2 space-y-1.5">
              {learningMetrics.effectivenessPolicy.recommendations.slice(0, 3).map((item) => (
                <div key={item.action} className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="text-white/60">{item.action.replace("_", " ")}</span>
                  <span className={item.direction === "positive" ? "text-emerald-200/80" : "text-amber-200/80"}>
                    {item.direction === "positive" ? "+" : ""}{item.delta} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {learningMetrics?.effectiveness.actions.length ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Action effectiveness</p>
            <div className="mt-2 space-y-1.5">
              {learningMetrics.effectiveness.actions.slice(0, 4).map((item) => (
                <div key={item.action} className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="text-white/60">{item.action.replace("_", " ")} · {item.sampleSize} tasks</span>
                  <span className="text-cyan-200/80">{item.completionRate}% completed · {item.positiveOutcomeRate}% positive</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!!learningMetrics?.attribution.recommendations.length && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Learning signals</p>
            <div className="mt-2 space-y-1.5">
              {learningMetrics.attribution.recommendations.slice(0, 3).map((item) => (
                <div key={`${item.dimension}-${item.group}`} className="flex items-center justify-between gap-3 text-[10px]">
                  <span className="text-white/60">{item.dimension.replace("_", " ")}: <span className="text-white/85">{item.group}</span></span>
                  <span className={item.direction === "positive" ? "text-emerald-300" : "text-rose-300"}>{item.delta > 0 ? "+" : ""}{item.delta} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-4">
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">High matches</p>
          <p className="mt-1 text-2xl font-semibold">{highMatches.length}</p>
          <p className="mt-1 text-[10px] text-emerald-200/70">70%+ fit</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Follow-ups</p>
          <p className="mt-1 text-2xl font-semibold">{followUps.length}</p>
          <p className="mt-1 text-[10px] text-amber-200/70">5+ days without movement</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Interviews</p>
          <p className="mt-1 text-2xl font-semibold">{interviews.length}</p>
          <p className="mt-1 text-[10px] text-cyan-200/70">active stage</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Next move</p>
          <p className="mt-1 text-sm font-semibold leading-5">{nextAction}</p>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">New opportunity signals</p>
            {lastScan && <span className="text-[10px] text-white/30">Scanned {lastScan}</span>}
          </div>
          {error && <p className="mt-3 text-xs text-amber-200">{error}</p>}
          {!error && highMatches.length === 0 && !loading && (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">No 70%+ opportunities in this scan. Try widening location, role or salary preferences.</p>
          )}
          <div className="mt-3 space-y-2">
            {highMatches.map((match) => (
              <div key={match.job.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{match.job.title}</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/45">{match.job.company} · {match.job.remote ? "Remote" : match.job.location}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-bold text-emerald-200">{match.score}%</span>
                  <Link href="/jobs" className="text-[10px] font-semibold text-cyan-200 hover:text-cyan-100">Inspect →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Action queue</p>
          <div className="mt-3 space-y-2">
            {followUps.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-400/15 bg-amber-400/[0.03] p-3">
                <p className="text-xs font-semibold">{(Array.isArray(item.jobs) ? item.jobs[0]?.title : item.jobs?.title) || "Application"}</p>
                <p className="mt-1 text-[10px] text-white/45">{companyName(Array.isArray(item.jobs) ? item.jobs[0]?.companies : item.jobs?.companies)} · {ageInDays(item.created_at)} days since applying</p>
                <Link href="/applications" className="mt-2 inline-block text-[10px] font-semibold text-amber-200">Open tracker →</Link>
              </div>
            ))}
            {interviews.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] p-3">
                <p className="text-xs font-semibold">{(Array.isArray(item.jobs) ? item.jobs[0]?.title : item.jobs?.title) || "Interview"}</p>
                <p className="mt-1 text-[10px] text-white/45">{companyName(Array.isArray(item.jobs) ? item.jobs[0]?.companies : item.jobs?.companies)} · interview stage</p>
                <Link href="/applications" className="mt-2 inline-block text-[10px] font-semibold text-cyan-200">Prepare →</Link>
              </div>
            ))}
            {!followUps.length && !interviews.length && (
              <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">No urgent application actions. The agent is watching your pipeline.</p>
            )}
          </div>
        </div>
      </div>
      </section>
    </>
  );
}
