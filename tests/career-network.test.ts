import { describe, expect, it } from "vitest";
import { buildCareerRelationships } from "@/lib/career-network";

describe("career network intelligence", () => {
  it("promotes an interview relationship", () => {
    const result = buildCareerRelationships([{
      recruiterId: "r1",
      companyId: "c1",
      companyName: "Acme",
      status: "interview",
      createdAt: "2026-10-01T10:00:00Z",
      updatedAt: "2026-10-08T10:00:00Z",
      recruiterResponseCount: 2,
    }], Date.parse("2026-10-09T10:00:00Z"));

    expect(result[0].status).toBe("interview_stage");
    expect(result[0].nextAction).toBe("prepare");
    expect(result[0].strengthScore).toBeGreaterThan(80);
  });

  it("creates a follow-up signal for an older active application", () => {
    const result = buildCareerRelationships([{
      recruiterId: "r1",
      companyId: "c1",
      companyName: "Acme",
      status: "applied",
      createdAt: "2026-09-25T10:00:00Z",
      updatedAt: "2026-10-01T10:00:00Z",
    }], Date.parse("2026-10-09T10:00:00Z"));

    expect(result[0].status).toBe("active");
    expect(result[0].nextAction).toBe("follow_up");
    expect(result[0].nextActionDueAt).toBeTruthy();
  });

  it("groups repeated applications by recruiter", () => {
    const result = buildCareerRelationships([
      { recruiterId: "r1", companyName: "Acme", status: "applied", createdAt: "2026-09-01T10:00:00Z" },
      { recruiterId: "r1", companyName: "Acme", status: "shortlisted", createdAt: "2026-10-01T10:00:00Z" },
    ], Date.parse("2026-10-09T10:00:00Z"));

    expect(result).toHaveLength(1);
    expect(result[0].interactionCount).toBe(2);
    expect(result[0].strengthScore).toBeGreaterThan(60);
  });
});
