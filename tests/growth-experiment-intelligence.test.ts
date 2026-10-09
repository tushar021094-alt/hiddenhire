import { describe, expect, it } from "vitest";
import { recommendGrowthExperiments } from "@/lib/growth-experiment-intelligence";

describe("growth experiment intelligence", () => {
  it("asks for baseline collection when event volume is sparse", () => {
    const result = recommendGrowthExperiments({ funnel: [], sources: [], totalEvents: 3 });
    expect(result[0].title).toBe("Collect a reliable baseline");
    expect(result[0].priority).toBe("low");
  });

  it("prioritizes landing activation when few visitors start searching", () => {
    const result = recommendGrowthExperiments({
      totalEvents: 100,
      sources: [],
      funnel: [
        { eventName: "landing_view", events: 100, uniqueActors: 90 },
        { eventName: "search_started", events: 10, uniqueActors: 10 },
      ],
    });
    expect(result[0].title).toBe("Improve landing-to-search activation");
    expect(result[0].priority).toBe("high");
  });

  it("flags signup abandonment without inventing conversion when no starts exist", () => {
    const result = recommendGrowthExperiments({
      totalEvents: 100,
      sources: [],
      funnel: [{ eventName: "signup_completed", events: 10, uniqueActors: 10 }],
    });
    expect(result.some((item) => item.title === "Reduce signup abandonment")).toBe(false);
  });

  it("uses a monitoring recommendation when funnel signals are healthy", () => {
    const result = recommendGrowthExperiments({
      totalEvents: 100,
      sources: [{ source: "direct", count: 20 }, { source: "campaign", count: 15 }],
      funnel: [
        { eventName: "landing_view", events: 100, uniqueActors: 90 },
        { eventName: "search_started", events: 60, uniqueActors: 55 },
        { eventName: "match_results_viewed", events: 40, uniqueActors: 40 },
        { eventName: "application_click", events: 20, uniqueActors: 20 },
        { eventName: "signup_started", events: 20, uniqueActors: 20 },
        { eventName: "signup_completed", events: 15, uniqueActors: 15 },
      ],
    });
    expect(result.some((item) => item.title === "Keep monitoring before changing the funnel")).toBe(true);
  });
});
