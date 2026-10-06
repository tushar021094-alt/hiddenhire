export type OutcomeIntelligenceObservation = {
  action: string; score: number; outcome: string; source: string; role: string; remote: boolean; createdAt: string; outcomeAt?: string | null;
};

const POSITIVE = new Set(["applied","reviewing","shortlisted","interview","hired"]);
const INTERVIEW = new Set(["interview","hired"]);
const RESOLVED = new Set(["applied","reviewing","shortlisted","interview","hired","rejected","withdrawn"]);

function rate(n: number, d: number) { return d ? Math.round((n / d) * 100) : 0; }
function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string,T[]>();
  for (const item of items) { const k = key(item); const list = map.get(k) ?? []; list.push(item); map.set(k,list); }
  return map;
}

export function buildOutcomeIntelligence(observations: OutcomeIntelligenceObservation[]) {
  const resolved = observations.filter((item) => RESOLVED.has(item.outcome));
  const summary = {
    resolved: resolved.length,
    positive: resolved.filter((item) => POSITIVE.has(item.outcome)).length,
    interviews: resolved.filter((item) => INTERVIEW.has(item.outcome)).length,
    hires: resolved.filter((item) => item.outcome === "hired").length,
    rejected: resolved.filter((item) => item.outcome === "rejected").length,
    withdrawn: resolved.filter((item) => item.outcome === "withdrawn").length,
  };
  const dimensions = [
    { dimension: "source", groups: groupBy(resolved, (x) => x.source || "unknown") },
    { dimension: "role", groups: groupBy(resolved, (x) => x.role || "unknown") },
    { dimension: "score_band", groups: groupBy(resolved, (x) => x.score >= 85 ? "85-100" : x.score >= 75 ? "75-84" : x.score >= 65 ? "65-74" : "0-64") },
    { dimension: "remote", groups: groupBy(resolved, (x) => x.remote ? "remote" : "non_remote") },
  ];
  const breakdowns = dimensions.map(({ dimension, groups }) => ({
    dimension,
    results: [...groups.entries()].map(([group, items]) => ({
      group, sampleSize: items.length, positiveRate: rate(items.filter((x) => POSITIVE.has(x.outcome)).length, items.length), interviewOrHireRate: rate(items.filter((x) => INTERVIEW.has(x.outcome)).length, items.length), hireRate: rate(items.filter((x) => x.outcome === "hired").length, items.length),
    })).sort((a,b) => b.sampleSize - a.sampleSize || b.positiveRate - a.positiveRate).slice(0,10),
  }));
  const latencyValues = resolved.filter((x) => x.outcomeAt).map((x) => Math.max(0, new Date(x.outcomeAt as string).getTime() - new Date(x.createdAt).getTime()) / 86400000);
  const medianLatencyDays = latencyValues.length ? Number([...latencyValues].sort((a,b) => a-b)[Math.floor(latencyValues.length / 2)].toFixed(1)) : null;
  return { summary: { ...summary, positiveRate: rate(summary.positive, summary.resolved), interviewOrHireRate: rate(summary.interviews, summary.resolved), hireRate: rate(summary.hires, summary.resolved), medianOutcomeDays: medianLatencyDays }, breakdowns };
}