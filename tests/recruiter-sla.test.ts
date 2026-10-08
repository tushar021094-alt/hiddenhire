import { describe, expect, it } from "vitest";
import { calculateRecruiterSla, recruiterSlaLabel } from "@/lib/recruiter-sla";

describe("recruiter SLA", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("calculates response rate and first-response speed", () => {
    const metrics = calculateRecruiterSla([
      { id:"1", status:"reviewing", createdAt:"2026-10-05T12:00:00Z", recruiterFirstResponseAt:"2026-10-06T00:00:00Z" },
      { id:"2", status:"applied", createdAt:"2026-10-07T12:00:00Z" },
      { id:"3", status:"rejected", createdAt:"2026-10-01T12:00:00Z", recruiterFirstResponseAt:"2026-10-01T18:00:00Z" },
      { id:"4", status:"shortlisted", createdAt:"2026-10-04T12:00:00Z", recruiterFirstResponseAt:"2026-10-04T15:00:00Z", responseDueAt:"2026-10-07T15:00:00Z" },
      { id:"5", status:"applied", createdAt:"2026-10-01T12:00:00Z", responseDueAt:"2026-10-05T12:00:00Z", candidateReminderCount:1 },
    ], now);
    expect(metrics.totalApplications).toBe(5);
    expect(metrics.respondedApplications).toBe(3);
    expect(metrics.responseRate).toBe(60);
    expect(metrics.overdueApplications).toBe(1);
    expect(metrics.remindedApplications).toBe(1);
    expect(metrics.medianFirstResponseHours).toBe(12);
    expect(metrics.health).not.toBe("insufficient_data");
  });

  it("does not count terminal applications as overdue", () => {
    const metrics = calculateRecruiterSla([
      { id:"1", status:"rejected", createdAt:"2026-10-01T00:00:00Z", responseDueAt:"2026-10-02T00:00:00Z" },
    ], now);
    expect(metrics.overdueApplications).toBe(0);
  });

  it("starts with insufficient data for small samples", () => {
    const metrics = calculateRecruiterSla([
      { id:"1", status:"applied", createdAt:"2026-10-08T00:00:00Z" },
    ], now);
    expect(metrics.health).toBe("insufficient_data");
    expect(recruiterSlaLabel(metrics)).toContain("Building");
  });
});
