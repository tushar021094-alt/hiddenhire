"use client";

import { useEffect, useState } from "react";
import type { MatchResult } from "@/lib/job-types";
import { buildCareerCopilot, type CareerCopilot as CareerCopilotResult } from "@/lib/career-copilot";

type Props = {
  targetRoles: string[];
  preferredLocations: string[];
  location: string | null;
  skills: string[];
  yearsOfExperience: number;
  minimumSalary: number;
  remoteOnly: boolean;
  applications: Array<{ status: string; created_at: string; title?: string | null; company?: string | null }>;
  profileReadiness: number;
};

export default function CareerCopilot({ ...props }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [copilot, setCopilot] = useState<CareerCopilotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/jobs/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetJobTitle: props.targetRoles[0] || "Finance Manager",
            targetRoles: props.targetRoles,
            yearsOfExperience: props.yearsOfExperience,
            minimumSalary: props.minimumSalary,
            preferredCurrency: "INR",
            preferredCountries: ["India"],
            preferredLocations: props.preferredLocations.length ? props.preferredLocations : (props.location ? [props.location] : ["Delhi NCR"]),
            remoteOnly: props.remoteOnly,
            preferredIndustries: [],
            skills: props.skills,
            keySkills: props.skills,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Unable to refresh career signal.");
        if (cancelled) return;
        const results = Array.isArray(payload?.results) ? payload.results : [];
        setMatches(results);
        setCopilot(buildCareerCopilot({ matches: results, applications: props.applications, profileReadiness: props.profileReadiness }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to refresh career signal.");
          setCopilot(buildCareerCopilot({ matches: [], applications: props.applications, profileReadiness: props.profileReadiness }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [props.targetRoles, props.preferredLocations, props.location, props.skills, props.yearsOfExperience, props.minimumSalary, props.remoteOnly, props.applications, props.profileReadiness]);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.025] to-cyan-400/[0.04]">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200">ADVANCED AI CAREER COPILOT</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">One decision layer for your career</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">The Copilot synthesizes your pipeline, live opportunity signal and profile readiness. It prioritizes; it does not invent outcomes or submit applications for you.</p>
          </div>
          <span className="rounded-full border border-violet-300/20 bg-violet-300/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-100">Phase 33</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-black/10 p-5 text-xs text-white/45">Synthesizing your current career signal…</div>
        ) : copilot ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-xl border border-white/10 bg-black/10 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-100">{copilot.situation.replace("_", " ")}</span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">{copilot.confidence} confidence</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-white">{copilot.headline}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{copilot.summary}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Signal snapshot</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><span className="text-[9px] text-white/35">Opportunities</span><strong className="mt-1 block text-xl">{matches.length}</strong></div>
                  <div><span className="text-[9px] text-white/35">80%+ matches</span><strong className="mt-1 block text-xl">{matches.filter((item) => item.score >= 80).length}</strong></div>
                  <div><span className="text-[9px] text-white/35">Applications</span><strong className="mt-1 block text-xl">{props.applications.length}</strong></div>
                  <div><span className="text-[9px] text-white/35">Readiness</span><strong className="mt-1 block text-xl">{props.profileReadiness}%</strong></div>
                </div>
              </div>
            </div>

            {copilot.priority ? (
              <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-200">Recommended next move</p>
                <h3 className="mt-2 text-base font-semibold text-white">{copilot.priority.title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/50">{copilot.priority.reason}</p>
                <p className="mt-3 text-xs font-medium text-violet-100">{copilot.priority.action}</p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Why the Copilot thinks this</p>
                <ul className="mt-3 space-y-2">{copilot.signals.map((signal) => <li key={signal} className="text-xs leading-5 text-white/55">• {signal}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">Next steps</p>
                <ol className="mt-3 space-y-2">{copilot.nextSteps.map((step, index) => <li key={step} className="text-xs leading-5 text-white/55"><span className="mr-2 text-violet-200">{index + 1}.</span>{step}</li>)}</ol>
              </div>
            </div>

            {copilot.blockers.length ? (
              <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200">Guardrails</p>
                {copilot.blockers.map((blocker) => <p key={blocker} className="mt-2 text-xs leading-5 text-amber-100/65">• {blocker}</p>)}
              </div>
            ) : null}
          </>
        ) : null}
        {error ? <p className="mt-4 text-xs text-amber-200/80">{error}</p> : null}
      </div>
    </section>
  );
}
