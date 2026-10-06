import { describe, expect, it } from "vitest";
import { optimizeCareerQueue } from "@/lib/career-agent-queue";

const base = {
  decision_score: 90,
  due_at: null,
  created_at: "2026-10-07T00:00:00.000Z",
  effective_status: "open" as const,
};

describe("Career Agent queue optimization", () => {
  it("keeps only the highest-value action per opportunity", () => {
    const items = [
      { ...base, id: "watch", job_fingerprint: "job-1", action: "watch" },
      { ...base, id: "review", job_fingerprint: "job-1", action: "review" },
      { ...base, id: "apply", job_fingerprint: "job-1", action: "apply_now" },
    ];
    const result = optimizeCareerQueue(items, Date.parse("2026-10-07T12:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("apply_now");
  });

  it("prioritizes overdue follow-ups and active interviews", () => {
    const items = [
      { ...base, id: "apply", job_fingerprint: "job-1", action: "apply_now", decision_score: 100 },
      { ...base, id: "follow", job_fingerprint: "job-2", action: "follow_up", due_at: "2026-10-06T00:00:00Z", application_status: "shortlisted" },
      { ...base, id: "prep", job_fingerprint: "job-3", action: "prepare", application_status: "interview" },
    ];
    const result = optimizeCareerQueue(items, Date.parse("2026-10-07T12:00:00Z"));
    expect(result[0].action).toBe("follow_up");
    expect(result[1].action).toBe("prepare");
  });

  it("caps the daily queue", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ ...base, id: String(i), job_fingerprint: "job-" + i, action: "review" }));
    expect(optimizeCareerQueue(items)).toHaveLength(12);
  });
});
