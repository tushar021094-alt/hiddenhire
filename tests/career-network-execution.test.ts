import { describe, expect, it } from "vitest";
import { buildExecutionTask } from "@/lib/career-agent-execution";

describe("career network execution bridge", () => {
  it("keeps relationship actions approval-gated", () => {
    const task = buildExecutionTask({
      id: "network:recruiter-1:follow_up",
      action: "follow_up",
      title: "Follow up with Acme",
      summary: "An active relationship is due for follow-up.",
      requiresApproval: true,
    });

    expect(task.state).toBe("awaiting_approval");
    expect(task.requiresApproval).toBe(true);
    expect(task.maxAttempts).toBe(3);
  });
});
