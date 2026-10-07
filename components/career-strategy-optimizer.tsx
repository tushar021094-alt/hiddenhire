"use client";

import { useState } from "react";
import type { MatchResult } from "@/lib/job-types";
import { buildCareerSimulation } from "@/lib/career-simulation";
import { generateCareerStrategyCandidates, rankCareerStrategies } from "@/lib/career-strategy-optimizer";

type Props = {
  targetRoles: string[];
  preferredLocations: string[];
  location: string | null;
  skills: string[];
  yearsOfExperience: number;
  minimumSalary: number;
  remoteOnly: boolean;
  matches: MatchResult[];
};

type SearchPayload = { results?: MatchResult[]; message?: string };

export default function CareerStrategyOptimizer(props: Props) {
  const [running, setRunning] = useState(false);
  const [recommendations, setRecommendations] = useState<ReturnType<typeof rankCareerStrategies>>([]);
  const [error, setError] = useState("");

  async function optimize() {
    if (!props.matches.length) return;
    setRunning(true);
    setError("");
    try {
      const candidates = generateCareerStrategyCandidates(
        props.matches,
        props.minimumSalary,
        props.remoteOnly,
        props.skills,
        props.preferredLocations.length ? props.preferredLocations : (props.location ? [props.location] : []),
      );

      const evaluated = await Promise.all(candidates.map(async (candidate) => {
        const profile = {
          targetJobTitle: props.targetRoles[0] || "Finance Manager",
          targetRoles: props.targetRoles,
          yearsOfExperience: props.yearsOfExperience,
          minimumSalary: candidate.changes.minimumSalary ?? props.minimumSalary,
          preferredCurrency: "INR",
          preferredCountries: ["India"],
          preferredLocations: [...props.preferredLocations, ...(candidate.changes.addLocations ?? [])],
          remoteOnly: candidate.changes.remoteOnly ?? props.remoteOnly,
          preferredIndustries: [],
          skills: [...props.skills, ...(candidate.changes.addSkills ?? [])],
          keySkills: [...props.skills, ...(candidate.changes.addSkills ?? [])],
        };

        const response = await fetch("/api/jobs/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        const payload: SearchPayload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Strategy optimization failed.");
        return { ...candidate, simulation: buildCareerSimulation(props.matches, Array.isArray(payload.results) ? payload.results : []) };
      }));

      setRecommendations(rankCareerStrategies(evaluated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Strategy optimization failed.");
    } finally {
      setRunning(false);
    }
  }

  const best = recommendations[0];

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-300/15 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.13),transparent_36%),linear-gradient(135deg,rgba(11,9,24,.98),rgba(15,19,42,.94))]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-violet-300">Career Strategy Optimizer</p>
            <h3 className="mt-1 text-xl font-semibold text-white">What should you change next?</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">HiddenHire tests evidence-backed strategy changes against the live market and ranks them by expected opportunity and interview-probability lift.</p>
          </div>
          <button type="button" onClick={() => void optimize()} disabled={running || !props.matches.length} className="rounded-lg bg-violet-300/10 px-4 py-2 text-xs font-semibold text-violet-100 ring-1 ring-violet-300/20 hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-40">
            {running ? "Testing strategy paths…" : "Optimize my strategy →"}
          </button>
        </div>
      </div>

      {error && <div className="mx-5 mt-4 rounded-lg border border-rose-400/15 bg-rose-400/[.04] p-3 text-[10px] text-rose-200 sm:mx-6">{error}</div>}

      {best && (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-200">Best next move</span>
              <span className="text-[9px] text-white/30">Rank #1 · strategy score {best.score}</span>
            </div>
            <h4 className="mt-2 text-lg font-semibold text-white">{best.label}</h4>
            <p className="mt-1 text-xs leading-5 text-white/50">{best.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] text-white/65">High probability {best.highProbabilityDelta > 0 ? "+" : ""}{best.highProbabilityDelta}</span>
              <span className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] text-white/65">Strong matches {best.strongMatchDelta > 0 ? "+" : ""}{best.strongMatchDelta}</span>
              <span className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] text-white/65">Opportunities {best.opportunityDelta > 0 ? "+" : ""}{best.opportunityDelta}</span>
              <span className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] text-white/65">Interview probability {best.averageInterviewProbabilityDelta > 0 ? "+" : ""}{best.averageInterviewProbabilityDelta} pts</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {recommendations.slice(0, 4).map((item) => (
              <div key={item.id} className="grid gap-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:grid-cols-[32px_1fr_auto] sm:items-center">
                <span className="text-xs font-semibold text-white/35">#{item.rank}</span>
                <div>
                  <p className="text-xs font-semibold text-white/80">{item.label}</p>
                  <p className="mt-0.5 text-[9px] text-white/35">{item.description}</p>
                </div>
                <div className="flex gap-2 text-[9px] text-white/45">
                  <span>High prob {item.highProbabilityDelta >= 0 ? "+" : ""}{item.highProbabilityDelta}</span>
                  <span>Strong {item.strongMatchDelta >= 0 ? "+" : ""}{item.strongMatchDelta}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[9px] leading-4 text-white/25">Recommendation is based on the current job market snapshot. It does not modify your profile; review the trade-off before applying any change.</p>
        </div>
      )}
    </section>
  );
}
