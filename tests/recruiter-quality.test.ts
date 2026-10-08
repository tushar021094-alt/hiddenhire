import { describe, expect, it } from "vitest";
import { recruiterQualityLabel, recruiterQualityTone, type RecruiterQuality } from "@/lib/recruiter-quality";

describe("recruiter quality", () => {
  it("keeps new recruiters neutral", () => {
    const q: RecruiterQuality = { recruiterId:"r", totalApplications:3, responseRate:100, overdueApplications:0, remindedApplications:0, medianFirstResponseHours:8, responsivenessScore:96, trustTier:"new", repeatedNonResponse:false };
    expect(recruiterQualityLabel(q)).toContain("Building");
    expect(recruiterQualityTone(q)).toBe("neutral");
  });
  it("labels strong response history", () => {
    const q: RecruiterQuality = { recruiterId:"r", totalApplications:20, responseRate:95, overdueApplications:0, remindedApplications:0, medianFirstResponseHours:12, responsivenessScore:95, trustTier:"highly_responsive", repeatedNonResponse:false };
    expect(recruiterQualityLabel(q)).toContain("Highly responsive");
    expect(recruiterQualityTone(q)).toBe("positive");
  });
});
