import type { RecruiterQuality } from "@/lib/recruiter-quality";
import { recruiterQualityLabel } from "@/lib/recruiter-quality";

export default function RecruiterQualityCard({ quality }: { quality: RecruiterQuality }) {
  const scoreTone = quality.trustTier === "highly_responsive" ? "text-emerald-300" : quality.trustTier === "responsive" ? "text-cyan-300" : quality.trustTier === "needs_attention" ? "text-amber-300" : "text-white/70";
  return (
    <section className="hh-panel mt-4">
      <div className="hh-panel-heading"><div><small>RECRUITER QUALITY · PHASE 24</small><h2>Candidate trust signal</h2></div><span className={scoreTone}>{quality.trustTier.replace("_", " ").toUpperCase()}</span></div>
      <p className="mt-2 text-sm text-white/45">{recruiterQualityLabel(quality)}. Public trust is only shown after enough application history.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><small className="text-xs uppercase tracking-wider text-white/35">Quality score</small><strong className={`mt-2 block text-3xl ${scoreTone}`}>{quality.responsivenessScore || "—"}</strong><span className="text-xs text-white/35">/ 100</span></div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><small className="text-xs uppercase tracking-wider text-white/35">Response rate</small><strong className="mt-2 block text-3xl text-white">{quality.responseRate}%</strong><span className="text-xs text-white/35">{quality.totalApplications} applications measured</span></div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><small className="text-xs uppercase tracking-wider text-white/35">Median response</small><strong className="mt-2 block text-3xl text-white">{quality.medianFirstResponseHours == null ? "—" : quality.medianFirstResponseHours < 24 ? `${quality.medianFirstResponseHours}h` : `${Math.round(quality.medianFirstResponseHours / 24 * 10) / 10}d`}</strong><span className="text-xs text-white/35">first recruiter update</span></div>
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><small className="text-xs uppercase tracking-wider text-white/35">Overdue</small><strong className={`mt-2 block text-3xl ${quality.overdueApplications ? "text-amber-300" : "text-white"}`}>{quality.overdueApplications}</strong><span className="text-xs text-white/35">active applications</span></div>
      </div>
      {quality.repeatedNonResponse && <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-sm text-amber-100/75">Repeated non-response has been detected. This remains an internal quality signal until the recruiter builds a healthier response history.</div>}
    </section>
  );
}
