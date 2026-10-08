import { describe, expect, it } from "vitest";
import { buildRecruiterOutreachPackage } from "@/lib/recruiter-outreach";

describe("recruiter outreach", () => {
  it("creates evidence-based outreach and requires approval", () => {
    const result = buildRecruiterOutreachPackage({
      candidateName: "Alex",
      jobTitle: "Finance Manager",
      companyName: "Acme",
      candidateSkills: ["FP&A", "Excel"],
      intelligence: {
        priority: "strong", recruiterScore: 91, fitScore: 92, readinessScore: 88,
        confidence: "high", reasons: ["Strong role alignment"], nextAction: "shortlist"
      }
    });
    expect(result.message).toContain("Finance Manager");
    expect(result.message).toContain("FP&A");
    expect(result.approvalRequired).toBe(true);
  });
});
