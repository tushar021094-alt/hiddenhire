import { describe, expect, it } from "vitest";
import { optimizeMarketplace } from "@/lib/marketplace-optimization";

describe("marketplace optimization", () => {
  it("restricts promotion when safety risk is high", () => {
    const result = optimizeMarketplace({
      audience: "platform",
      fraudRiskTier: "high",
      jobAuthenticityScore: 95,
      recruiterTrustScore: 95,
      isVerified: true,
    });
    expect(result.action).toBe("limit");
    expect(result.confidence).toBe("high");
    expect(result.reasons.join(" ")).toContain("Fraud risk is high");
  });

  it("promotes only when quality and conversion signals are strong", () => {
    const result = optimizeMarketplace({
      audience: "platform",
      fraudRiskTier: "low",
      jobAuthenticityScore: 94,
      recruiterTrustScore: 90,
      recruiterResponseRate: 92,
      views: 100,
      applicationsStarted: 18,
      completedApplications: 15,
      qualifiedMatches: 20,
      applications: 8,
      isVerified: true,
    });
    expect(result.action).toBe("promote");
    expect(result.score).toBeGreaterThanOrEqual(78);
    expect(result.reasons).toContain("Application completion is healthy.");
  });

  it("recommends improving weak conversion instead of boosting", () => {
    const result = optimizeMarketplace({
      audience: "recruiter",
      jobAuthenticityScore: 72,
      recruiterTrustScore: 58,
      recruiterResponseRate: 30,
      views: 100,
      applicationsStarted: 1,
      completedApplications: 0,
      qualifiedMatches: 10,
      applications: 0,
      isVerified: true,
    });
    expect(result.action).toBe("improve");
    expect(result.reasons.some((reason) => reason.includes("conversion is low"))).toBe(true);
  });

  it("never bypasses an exhausted plan limit", () => {
    const result = optimizeMarketplace({
      audience: "recruiter",
      usageRatio: 1,
      jobAuthenticityScore: 90,
      recruiterTrustScore: 90,
      recruiterResponseRate: 90,
      isVerified: true,
    });
    expect(result.action).toBe("hold");
    expect(result.nextStep).toContain("Respect the current plan limit");
  });

  it("reduces confidence when there is too little evidence", () => {
    const result = optimizeMarketplace({ audience: "candidate" });
    expect(result.confidence).toBe("low");
    expect(result.action).toBe("improve");
  });
});
