"use client";

import { fraudRiskLabel, type FraudRisk } from "@/lib/fraud-risk";

export default function FraudRiskBadge({ risk }: { risk?: FraudRisk }) {
  if (!risk) return null;

  const tone =
    risk.tier === "critical"
      ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
      : risk.tier === "high"
        ? "border-orange-300/25 bg-orange-300/10 text-orange-200"
        : risk.tier === "guarded"
          ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={"rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " + tone}>
        {fraudRiskLabel(risk)}
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.1em] text-white/40"
        title="Heuristic fraud-risk score; higher values mean more detected risk. This is not a guarantee that a job is safe or fraudulent."
      >
        Risk score {risk.score}/100
      </span>
    </div>
  );
}
