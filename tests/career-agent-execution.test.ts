import { describe, expect, it } from "vitest";
import { buildExecutionTask, transitionExecutionTask } from "@/lib/career-agent-execution";

describe("career agent execution", () => {
  it("approval-gates execution by default", () => {
    const task = buildExecutionTask({ id:"1", action:"apply", title:"Apply", summary:"Prepare application" });
    expect(task.state).toBe("awaiting_approval");
    expect(task.requiresApproval).toBe(true);
  });
  it("moves through an approved execution lifecycle", () => {
    expect(transitionExecutionTask("awaiting_approval","approve")).toBe("approved");
    expect(transitionExecutionTask("approved","start")).toBe("executing");
    expect(transitionExecutionTask("executing","complete")).toBe("completed");
  });
  it("cannot skip approval", () => {
    expect(transitionExecutionTask("awaiting_approval","start")).toBe("awaiting_approval");
  });

  it("cannot disable approval for application or follow-up actions", () => {
    for (const action of ["apply", "follow_up"] as const) {
      const task = buildExecutionTask({
        id: action,
        action,
        title: "External action",
        summary: "Requires a person to approve it.",
        requiresApproval: false,
      });
      expect(task.requiresApproval).toBe(true);
      expect(task.state).toBe("awaiting_approval");
    }
  });
  it("allows non-side-effecting review tasks to be queued when explicitly safe", () => {
    const task = buildExecutionTask({
      id: "review",
      action: "review",
      title: "Review profile",
      summary: "Inspect the profile.",
      requiresApproval: false,
    });
    expect(task.requiresApproval).toBe(false);
    expect(task.state).toBe("queued");
  });
});
