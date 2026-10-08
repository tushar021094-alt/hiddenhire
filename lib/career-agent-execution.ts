export type ExecutionAction = "prepare" | "follow_up" | "review" | "apply";
export type ExecutionState = "queued" | "awaiting_approval" | "approved" | "executing" | "completed" | "failed" | "cancelled";

export type ExecutionTask = {
  id: string;
  action: ExecutionAction;
  state: ExecutionState;
  title: string;
  summary: string;
  requiresApproval: boolean;
  maxAttempts: number;
};

export function buildExecutionTask(input: {
  id: string;
  action: ExecutionAction;
  title: string;
  summary: string;
  requiresApproval?: boolean;
}): ExecutionTask {
  const requiresApproval = input.requiresApproval ?? true;
  return {
    ...input,
    state: requiresApproval ? "awaiting_approval" : "queued",
    requiresApproval,
    maxAttempts: 3,
  };
}

export function transitionExecutionTask(
  state: ExecutionState,
  event: "approve" | "start" | "complete" | "fail" | "cancel"
): ExecutionState {
  if (event === "approve" && state === "awaiting_approval") return "approved";
  if (event === "start" && (state === "approved" || state === "queued")) return "executing";
  if (event === "complete" && state === "executing") return "completed";
  if (event === "fail" && state === "executing") return "failed";
  if (event === "cancel" && !["completed","cancelled"].includes(state)) return "cancelled";
  return state;
}
