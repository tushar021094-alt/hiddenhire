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
});
