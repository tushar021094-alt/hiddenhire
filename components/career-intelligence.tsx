"use client";

import { useMemo } from "react";
import type { MatchResult } from "@/lib/job-types";
import { buildCareerIntelligence } from "@/lib/career-intelligence";

type Props = {
  targetRoles: string[]; preferredLocations: string[]; location: string | null; skills: string[];
  yearsOfExperience: number; minimumSalary: number; remoteOnly: boolean; matches: MatchResult[];
};

function dimensionLabel(value: number) {
  if (value >= 85) return "Excellent";
  if (value >= 70) return "Strong";
  if (value >= 50) return "Developing";
  return "Needs work";
}

export default function CareerIntelligence(props: Props) {
  const intelligence = useMemo(() => buildCareerIntelligence(props), [props]);
  const dimensions = [
    ["Role clarity", intelligence.dimensions.roleClarity],
    ["Skill depth", intelligence.dimensions.skillDepth],
    ["Experience", intelligence.dimensions.experienceStrength],
    ["Market fit", intelligence.dimensions.marketFit],
    ["Search readiness", intelligence.dimensions.searchReadiness],
  ] as const;

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.14),transparent_36%),linear-gradient(135deg,rgba(15,23,42,.9),rgba(10,18,38,.78))] shadow-[0_20px_70px_rgba(0,0,0,.22)]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[.24em] text-violet-300">Career Intelligence Core</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">LIVE SIGNAL</span>
            </div>
            <h3 className="mt-1 text-xl font-semibold text-white">Your career signal is {intelligence.score}%</h3>
            <p className="mt-1 text-xs text-white/50">A continuously calculated view of profile strength, market fit and the actions most likely to improve your next opportunity.</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[.035] px-4 py-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/30 bg-violet-400/10 text-lg font-bold text-white">{intelligence.score}</div>
            <div><strong className="block text-sm text-white">{intelligence.label}</strong><span className="text-[11px] text-white/45">{intelligence.evidence.jobsAnalyzed} live roles analyzed</span></div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 sm:px-6">
        {dimensions.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] text-white/55">{label}</span><span className="text-[10px] font-semibold text-white/75">{value}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-400 to-pink-400" style={{ width: `${value}%` }} /></div>
            <span className="mt-2 block text-[10px] uppercase tracking-wider text-white/35">{dimensionLabel(value)}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 border-t border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
        <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-300">Strongest signals</p><div className="space-y-2">{intelligence.strongestSignals.map((item) => <div key={item} className="rounded-lg border border-emerald-400/10 bg-emerald-400/[.035] px-3 py-2 text-xs leading-5 text-white/70"><span className="mr-2 text-emerald-300">✓</span>{item}</div>)}</div></div>
        <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Gaps detected</p><div className="space-y-2">{intelligence.gaps.length ? intelligence.gaps.map((item) => <div key={item} className="rounded-lg border border-amber-400/10 bg-amber-400/[.035] px-3 py-2 text-xs leading-5 text-white/65"><span className="mr-2 text-amber-300">△</span>{item}</div>) : <div className="rounded-lg border border-white/8 bg-white/[.025] px-3 py-2 text-xs text-white/50">No material gaps detected from the current evidence.</div>}</div></div>
        <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-300">Priority actions</p><div className="space-y-2">{intelligence.priorityActions.length ? intelligence.priorityActions.map((item, index) => <div key={item} className="rounded-lg border border-cyan-400/10 bg-cyan-400/[.035] px-3 py-2 text-xs leading-5 text-white/65"><span className="mr-2 font-semibold text-cyan-300">0{index + 1}</span>{item}</div>) : <div className="rounded-lg border border-white/8 bg-white/[.025] px-3 py-2 text-xs text-white/50">Keep monitoring the live signal as new opportunities arrive.</div>}</div></div>
      </div>
      <div className="grid grid-cols-3 border-t border-white/10 bg-black/10 text-center">
        <div className="px-3 py-3"><strong className="block text-base text-white">{intelligence.evidence.topMatch || 0}%</strong><span className="text-[9px] uppercase tracking-wider text-white/35">Top match</span></div>
        <div className="border-x border-white/10 px-3 py-3"><strong className="block text-base text-white">{intelligence.evidence.averageMatch || 0}%</strong><span className="text-[9px] uppercase tracking-wider text-white/35">Average match</span></div>
        <div className="px-3 py-3"><strong className="block text-base text-white">{intelligence.evidence.strongMatches}</strong><span className="text-[9px] uppercase tracking-wider text-white/35">Strong matches</span></div>
      </div>
    </section>
  );
}
