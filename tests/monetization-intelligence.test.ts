import { describe, expect, it } from "vitest";
import { buildMonetizationRecommendation } from "@/lib/monetization-intelligence";

describe("monetization intelligence", () => {
  it("does not upsell when usage is comfortably below limits", () => {
    const result = buildMonetizationRecommendation({
      audience: "candidate",
      currentPlan: "candidate_free",
      usage: [
        { key: "saved_jobs", used: 2 },
        { key: "ai_resume_optimizations", used: 0 },
        { key: "ai_cover_letters", used: 0 },
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.urgency).toBe("none");
  });

  it("recommends the next candidate plan when a limit is reached", () => {
    const result = buildMonetizationRecommendation({
      audience: "candidate",
      currentPlan: "candidate_free",
      usage: [{ key: "saved_jobs", used: 10 }],
    });
    expect(result.eligible).toBe(true);
    expect(result.planId).toBe("candidate_plus");
    expect(result.urgency).toBe("high");
  });

  it("recommends employer starter only when employer capacity is constrained", () => {
    const result = buildMonetizationRecommendation({
      audience: "employer",
      currentPlan: "employer_free",
      usage: [{ key: "active_jobs", used: 1 }],
    });
    expect(result.planId).toBe("employer_starter");
    expect(result.eligible).toBe(true);
  });
});
