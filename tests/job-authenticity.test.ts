import { describe, expect, it } from "vitest";
import { evaluateJobAuthenticity } from "@/lib/job-authenticity";

describe("job authenticity intelligence", () => {
  it("marks a fully verified native job as verified", () => {
    const result = evaluateJobAuthenticity({
      source: "HiddenHire",
      company: "Acme",
      companyWebsite: "https://acme.example",
      applicationUrl: "https://hiddenhire.example/apply/1",
      description: "A detailed role description ".repeat(20),
      verifiedCompany: true,
      verifiedRecruiter: true,
    });
    expect(result.verifiedJob).toBe(true);
    expect(result.tier).toBe("verified");
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("downgrades suspicious payment language", () => {
    const result = evaluateJobAuthenticity({
      source: "HiddenHire",
      company: "Acme",
      applicationUrl: "https://example.com/apply",
      description: "Pay a fee to guarantee your job and complete registration.".repeat(8),
      verifiedCompany: true,
      verifiedRecruiter: true,
    });
    expect(result.verifiedJob).toBe(false);
    expect(result.flags).toContain("suspicious payment or contact language");
    expect(result.tier).toBe("caution");
  });

  it("flags duplicate posting patterns", () => {
    const result = evaluateJobAuthenticity({
      source: "HiddenHire",
      company: "Acme",
      applicationUrl: "https://example.com/apply",
      description: "Detailed job description ".repeat(20),
      verifiedCompany: true,
      verifiedRecruiter: true,
      duplicateCount: 4,
    });
    expect(result.verifiedJob).toBe(false);
    expect(result.flags).toContain("similar posting pattern detected");
  });

  it("trusts ATS provenance without claiming recruiter verification", () => {
    const result = evaluateJobAuthenticity({
      source: "greenhouse",
      company: "Acme",
      companyWebsite: "https://acme.example",
      applicationUrl: "https://boards.greenhouse.io/acme/jobs/1",
      description: "Detailed job description ".repeat(20),
    });
    expect(result.sourceVerified).toBe(true);
    expect(result.verifiedRecruiter).toBe(false);
    expect(result.verifiedJob).toBe(true);
  });
});
