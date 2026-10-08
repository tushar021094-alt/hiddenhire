import { describe, expect, it } from "vitest";
import { buildExecutionTask } from "@/lib/career-agent-execution";

describe("career operation execution bridge", () => {
  it("keeps approval-required operations gated", () => {
    const task = buildExecutionTask({ id:"follow-up:1", action:"follow_up", title:"Follow up", summary:"Contact recruiter", requiresApproval:true });
    expect(task.state).toBe("awaiting_approval");
  });
  it("allows preparation operations to be queued without outbound approval", () => {
    const task = buildExecutionTask({ id:"interview:1", action:"prepare", title:"Prepare", summary:"Build interview plan", requiresApproval:false });
    expect(task.state).toBe("queued");
  });
});
