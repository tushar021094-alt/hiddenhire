import { describe, expect, it } from "vitest";
import { buildCareerCopilot } from "@/lib/career-copilot";

const match = (score: number) => ({
  score,
  opportunityScore: score,
  roleRelevanceScore: score,
  scoreBreakdown: { skills: 15, experience: 15, location: 10, salary: 10 },
  missingRequirements: [],
  seniorityCompatibility: "GOOD",
  job: { title: "Finance Manager", company: "Acme", location: "Delhi", remote: false, applicationUrl: "https://example.com" },
} as any);

describe("career copilot", () => {
  it("prioritizes an active interview", () => {
    const result = buildCareerCopilot({
      matches: [match(95)],
      applications: [{ status: "interview", created_at: "2026-10-08T00:00:00.000Z", title: "Finance Manager", company: "Acme" }],
    }, new Date("2026-10-09T00:00:00.000Z").getTime());

    expect(result.situation).toBe("prepare");
    expect(result.priority?.title).toContain("Finance Manager");
  });

  it("prioritizes an overdue application follow-up", () => {
    const result = buildCareerCopilot({
      matches: [],
      applications: [{ status: "applied", created_at: "2026-10-01T00:00:00.000Z", company: "Acme" }],
    }, new Date("2026-10-09T00:00:00.000Z").getTime());

    expect(result.situation).toBe("follow_up");
    expect(result.priority?.urgency).toBe("high");
  });

  it("does not force an action when the profile and opportunity stream are healthy", () => {
    const result = buildCareerCopilot({
      matches: [match(72)],
      applications: [],
      profileReadiness: 100,
    });

    expect(result.situation).toBe("monitor");
    expect(result.priority).toBeNull();
  });
});
