import { PLAN_DEFINITIONS, type EntitlementKey, type PlanId } from "@/lib/entitlements";

export type UsageSignal = {
  key: EntitlementKey;
  used: number;
  limit?: number;
};

export type MonetizationRecommendation = {
  planId: PlanId;
  audience: "candidate" | "employer" | "agency";
  eligible: boolean;
  urgency: "none" | "soft" | "high";
  headline: string;
  reason: string;
  valueSignals: string[];
};

export function buildMonetizationRecommendation(input: {
  audience: "candidate" | "employer" | "agency";
  currentPlan: PlanId;
  usage: UsageSignal[];
}): MonetizationRecommendation {
  const plans = Object.values(PLAN_DEFINITIONS).filter((plan) => plan.audience === input.audience);
  const current = PLAN_DEFINITIONS[input.currentPlan];
  const candidates = plans
    .filter((plan) => plan.id !== input.currentPlan && plan.monthlyPriceInr > current.monthlyPriceInr)
    .sort((a, b) => a.monthlyPriceInr - b.monthlyPriceInr);
  const target = candidates[0];

  if (!target) {
    return {
      planId: input.currentPlan,
      audience: input.audience,
      eligible: false,
      urgency: "none",
      headline: "Your current plan is sufficient.",
      reason: "There is no higher plan required by the current entitlement model.",
      valueSignals: [],
    };
  }

  const nearLimit = input.usage.filter((item) => {
    const limit = item.limit ?? current.limits[item.key];
    return Number.isFinite(limit) && Number(limit) > 0 && item.used / Number(limit) >= 0.8;
  });

  const exhausted = input.usage.filter((item) => {
    const limit = item.limit ?? current.limits[item.key];
    return Number.isFinite(limit) && Number(limit) > 0 && item.used >= Number(limit);
  });

  const signals = [...new Set([
    ...exhausted.map((item) => `${item.key.replaceAll("_", " ")} limit reached`),
    ...nearLimit.map((item) => `${item.key.replaceAll("_", " ")} usage is near its limit`),
  ])];

  if (!signals.length) {
    return {
      planId: target.id,
      audience: input.audience,
      eligible: false,
      urgency: "none",
      headline: "Stay on your current plan.",
      reason: "Current usage does not indicate a meaningful need to upgrade.",
      valueSignals: [],
    };
  }

  return {
    planId: target.id,
    audience: input.audience,
    eligible: true,
    urgency: exhausted.length ? "high" : "soft",
    headline: `Consider ${target.id.replaceAll("_", " ")} when you need more capacity.`,
    reason: exhausted.length
      ? "You have reached at least one current-plan limit."
      : "Your usage is approaching a current-plan limit.",
    valueSignals: signals.slice(0, 4),
  };
}
