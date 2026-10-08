import type { RecruiterSlaMetrics } from "@/lib/recruiter-sla";
import { recruiterSlaLabel } from "@/lib/recruiter-sla";

export default function RecruiterSlaCard({ metrics }: { metrics: RecruiterSlaMetrics }) {
  const scoreTone =
    metrics.health === "excellent" ? "text-emerald-300" :
    metrics.health === "good" ? "text-cyan-300" :
    metrics.health === "needs_attention" ? "text-amber-300" :
    "text-white/70";

  return (
    <section className="hh-panel mt-6">
      <div className="hh-panel-heading">
        <div>
          <small>RECRUITER SLA · PHASE 23</small>
          <h2>Responsiveness health</h2>
        </div>
        <span className={scoreTone}>{metrics.health.replace("_", " ").toUpperCase()}</span>
      </div>

      <div className="mt-2 text-sm text-white/45">
        {recruiterSlaLabel(metrics)}. HiddenHire measures actual recruiter status updates, not candidate activity.
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
          <small className="text-xs uppercase tracking-wider text-white/35">Responsiveness</small>
          <strong className={`mt-2 block text-3xl ${scoreTone}`}>{metrics.responsivenessScore}</strong>
          <span className="text-xs text-white/35">/ 100</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
          <small className="text-xs uppercase tracking-wider text-white/35">Response rate</small>
          <strong className="mt-2 block text-3xl text-white">{metrics.responseRate}%</strong>
          <span className="text-xs text-white/35">{metrics.respondedApplications} responded</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
          <small className="text-xs uppercase tracking-wider text-white/35">Median response</small>
          <strong className="mt-2 block text-3xl text-white">
            {metrics.medianFirstResponseHours == null ? "—" : metrics.medianFirstResponseHours < 24 ? `${metrics.medianFirstResponseHours}h` : `${Math.round(metrics.medianFirstResponseHours / 24 * 10) / 10}d`}
          </strong>
          <span className="text-xs text-white/35">first recruiter update</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
          <small className="text-xs uppercase tracking-wider text-white/35">Needs action</small>
          <strong className={`mt-2 block text-3xl ${metrics.overdueApplications ? "text-amber-300" : "text-white"}`}>{metrics.overdueApplications}</strong>
          <span className="text-xs text-white/35">overdue active applications</span>
        </div>
      </div>

      {metrics.remindedApplications > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm text-amber-100/75">
          {metrics.remindedApplications} application{metrics.remindedApplications === 1 ? "" : "s"} has received a candidate reminder.
          Update those applications to keep the response pipeline healthy.
        </div>
      )}
    </section>
  );
}
