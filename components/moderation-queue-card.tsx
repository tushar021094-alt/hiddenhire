"use client";

type ModerationMetrics = {
  total: number;
  urgent: number;
  review: number;
  monitor: number;
  restricted: number;
};

export default function ModerationQueueCard({ metrics }: { metrics: ModerationMetrics }) {
  const urgent = metrics.urgent > 0;
  return (
    <section className="hh-panel" style={{ borderColor: urgent ? "rgba(251,113,133,.28)" : undefined }}>
      <div className="hh-panel-heading">
        <div><small>MODERATION CONTROL · PHASE 28</small><h2>Trust-aware review queue</h2></div>
        <span className={urgent ? "text-rose-200" : "text-emerald-200"}>{urgent ? "ACTION REQUIRED" : "HEALTHY"}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div><small className="text-white/40">Total</small><strong className="block text-xl">{metrics.total}</strong></div>
        <div><small className="text-white/40">Urgent</small><strong className="block text-xl">{metrics.urgent}</strong></div>
        <div><small className="text-white/40">Review</small><strong className="block text-xl">{metrics.review}</strong></div>
        <div><small className="text-white/40">Monitor</small><strong className="block text-xl">{metrics.monitor}</strong></div>
        <div><small className="text-white/40">Restricted</small><strong className="block text-xl">{metrics.restricted}</strong></div>
      </div>
      <p className="mt-3 text-xs text-white/45">Prioritization is evidence-based: safety risk, authenticity, candidate reports, moderation history and recruiter trust.</p>
    </section>
  );
}
