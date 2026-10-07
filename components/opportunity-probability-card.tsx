"use client";
import { useMemo } from "react";
import type { MatchResult } from "@/lib/job-types";
import { estimateInterviewProbability, type ProbabilityEvidence } from "@/lib/career-probability";

type Props = { match: MatchResult; evidence?: ProbabilityEvidence };

export default function OpportunityProbabilityCard({ match, evidence }: Props) {
  const model = useMemo(() => estimateInterviewProbability(match, evidence), [match, evidence]);
  return <div className="rounded-lg border border-violet-300/10 bg-violet-300/[.025] p-3">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-violet-200/70">Opportunity graph</p><p className="mt-1 text-[10px] text-white/45">{model.evidenceLabel}</p></div>
      <div className="text-right"><span className="block text-[8px] uppercase tracking-wider text-white/30">Est. interview probability</span><strong className="text-xl text-violet-100">{model.interviewProbability}%</strong></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {model.drivers.slice(0, 4).map((driver) => <div key={driver.label} className="rounded-md border border-white/8 bg-black/10 p-2"><div className="flex items-center justify-between"><span className="text-[8px] text-white/35">{driver.label}</span><span className={driver.kind === "friction" ? "text-[8px] text-amber-200/70" : "text-[8px] text-white/30"}>{driver.value}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-violet-300/70" style={{ width: driver.value + "%" }} /></div></div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {model.friction.slice(0, 3).map((item) => <span key={item} className="rounded-full border border-amber-300/10 bg-amber-300/[.04] px-2 py-1 text-[8px] text-amber-100/65">Friction · {item}</span>)}
      {!model.friction.length && <span className="text-[9px] text-emerald-200/60">No material fit friction detected.</span>}
    </div>
  </div>;
}