import { describe, expect, it } from "vitest";
import { applyLearningPolicy, buildAttributionInsights, getLearningPolicyAdjustment } from "@/lib/career-learning-attribution";

describe("adaptive ranking policy", () => {
  it("remains inactive until sufficient evidence exists", () => {
    const policy = buildAttributionInsights(Array.from({ length: 29 }, (_, i) => ({
      action: "apply_now", decisionScore: 90, outcome: i < 25 ? "interview" : "rejected",
      source: "greenhouse", role: "Finance", remote: false,
    }))).policy;
    expect(policy.eligible).toBe(false);
    expect(getLearningPolicyAdjustment({ source: "greenhouse", role: "Finance", remote: false, score: 90 }, policy)).toBe(0);
  });

  it("applies eligible score-band and source evidence to ranking", () => {
    const observations = [
      ...Array.from({ length: 35 }, () => ({ action:"apply_now", decisionScore:90, outcome:"interview", source:"greenhouse", role:"Finance", remote:false })),
      ...Array.from({ length: 35 }, () => ({ action:"review", decisionScore:60, outcome:"rejected", source:"other", role:"Sales", remote:true })),
    ];
    const policy = buildAttributionInsights(observations).policy;
    expect(policy.eligible).toBe(true);
    const adjustment = getLearningPolicyAdjustment({ source:"greenhouse", role:"Finance", remote:false, score:90 }, policy);
    expect(adjustment).toBeGreaterThan(0);
    expect(applyLearningPolicy(82, { source:"greenhouse", role:"Finance", remote:false, score:90 }, policy)).toBeGreaterThan(82);
  });
});
