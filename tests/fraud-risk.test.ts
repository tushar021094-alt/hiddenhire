import { describe, expect, it } from "vitest";
import { evaluateFraudRisk } from "@/lib/fraud-risk";

describe("fraud risk intelligence", () => {
  it("keeps strongly verified jobs low risk", () => {
    const result = evaluateFraudRisk({
      authenticityScore: 94,
      authenticityTier: "verified",
      recruiterTrustScore: 92,
      recruiterIdentityVerified: true,
      companyVerified: true,
    });
    expect(result.tier).toBe("low");
    expect(result.action).toBe("allow");
  });

  it("escalates suspicious payment language", () => {
    const result = evaluateFraudRisk({
      authenticityScore: 40,
      authenticityTier: "caution",
      suspiciousLanguage: true,
      reportCount: 2,
      moderationIssueCount: 1,
    });
    expect(result.tier).toBe("critical");
    expect(result.action).toBe("escalate");
    expect(result.flags).toContain("suspicious payment or contact language");
  });

  it("warns when evidence is mixed", () => {
    const result = evaluateFraudRisk({
      authenticityScore: 68,
      recruiterTrustScore: 55,
      companyVerified: false,
      recruiterIdentityVerified: false,
    });
    expect(result.tier).toBe("guarded");
    expect(result.action).toBe("warn");
  });

  it("does not treat unverified identity alone as fraud", () => {
    const result = evaluateFraudRisk({
      authenticityScore: 82,
      recruiterTrustScore: 70,
      recruiterIdentityVerified: false,
      companyVerified: true,
    });
    expect(result.score).toBeLessThan(25);
    expect(result.tier).toBe("low");
  });
});
