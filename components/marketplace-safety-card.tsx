"use client";

type SafetyMetrics = {
  totalJobs: number;
  guardedJobs: number;
  highRiskJobs: number;
  criticalJobs: number;
  escalations: number;
};

export default function MarketplaceSafetyCard({ metrics }: { metrics: SafetyMetrics }) {
  const tone = metrics.criticalJobs > 0 ? "text-rose-200" : metrics.highRiskJobs > 0 ? "text-amber-200" : "text-emerald-200";
  return (
    <section className="hh-panel" style={{ borderColor: metrics.criticalJobs ? "rgba(251,113,133,.25)" : undefined }}>
      <div className="hh-panel-heading">
        <div><small>MARKETPLACE SAFETY · PHASE 27</small><h2>Fraud & safety signals</h2></div>
        <span className={tone}>LIVE</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><small className="text-white/40">Guarded</small><strong className="block text-xl">{metrics.guardedJobs}</strong></div>
        <div><small className="text-white/40">High risk</small><strong className="block text-xl">{metrics.highRiskJobs}</strong></div>
        <div><small className="text-white/40">Critical</small><strong className="block text-xl">{metrics.criticalJobs}</strong></div>
        <div><small className="text-white/40">Escalations</small><strong className="block text-xl">{metrics.escalations}</strong></div>
      </div>
      <p className="mt-3 text-xs text-white/45">
        Risk combines authenticity, reports, moderation history and recruiter trust. It is a safety layer, not a hiring-match score.
      </p>
    </section>
  );
}
