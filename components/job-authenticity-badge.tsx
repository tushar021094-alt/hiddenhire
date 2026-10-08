"use client";

import { authenticityLabel, type JobAuthenticity } from "@/lib/job-authenticity";

export default function JobAuthenticityBadge({ authenticity }: { authenticity?: JobAuthenticity }) {
  if (!authenticity) return null;

  const tone =
    authenticity.verifiedJob
      ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
      : authenticity.tier === "likely_authentic"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
        : authenticity.tier === "review"
          ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
          : "border-rose-300/20 bg-rose-300/10 text-rose-200";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={"rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " + tone}>
        {(authenticity.verifiedJob ? "✓ " : "") + authenticityLabel(authenticity)}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">
        Trust {authenticity.score}/100
      </span>
    </div>
  );
}
