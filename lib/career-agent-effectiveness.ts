export function buildCareerAgentEffectiveness(observations: Array<{ action: string; taskStatus: "open" | "completed" | "dismissed"; outcome: string }>) {
  const actions = new Map<string, typeof observations>();
  for (const item of observations) actions.set(item.action, [...(actions.get(item.action) ?? []), item]);
  const summarize = (items: typeof observations) => {
    const completed = items.filter((x) => x.taskStatus === "completed").length;
    const dismissed = items.filter((x) => x.taskStatus === "dismissed").length;
    const resolved = items.filter((x) => x.outcome !== "not_started");
    const positive = resolved.filter((x) => ["applied","reviewing","shortlisted","interview","hired"].includes(x.outcome));
    const strong = resolved.filter((x) => ["interview","hired"].includes(x.outcome));
    return { sampleSize: items.length, completed, dismissed, completionRate: Math.round(completed / Math.max(items.length, 1) * 100), dismissalRate: Math.round(dismissed / Math.max(items.length, 1) * 100), resolvedOutcomes: resolved.length, positiveOutcomeRate: Math.round(positive.length / Math.max(resolved.length, 1) * 100), interviewOrHireRate: Math.round(strong.length / Math.max(resolved.length, 1) * 100) };
  };
  return { ...summarize(observations), actions: [...actions.entries()].map(([action, items]) => ({ action, ...summarize(items) })).sort((a,b) => b.sampleSize - a.sampleSize) };
}
