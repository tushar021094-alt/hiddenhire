import { describe, expect, it } from "vitest";
import { assessMarketplaceModeration } from "@/lib/moderation-engine";

describe("marketplace moderation engine", () => {
  it("creates an urgent queue for critical risk", () => {
    const result = assessMarketplaceModeration({
      safetyScore: 90, safetyTier: "critical", safetyAction: "escalate",
      authenticityScore: 40, reportCount: 2, moderationIssueCount: 1,
    });
    expect(result.queue).toBe("urgent");
    expect(result.decision).toBe("escalate");
  });

  it("creates a review queue for meaningful mixed evidence", () => {
    const result = assessMarketplaceModeration({
      safetyScore: 55, safetyTier: "high", safetyAction: "restrict",
      authenticityScore: 65, reportCount: 1, moderationIssueCount: 0,
    });
    expect(result.queue).toBe("review");
  });

  it("does not punish an ordinary low-risk job", () => {
    const result = assessMarketplaceModeration({
      safetyScore: 8, safetyTier: "low", safetyAction: "allow",
      authenticityScore: 90, reportCount: 0, moderationIssueCount: 0,
    });
    expect(result.queue).toBe("none");
    expect(result.priority).toBe(0);
  });
});
