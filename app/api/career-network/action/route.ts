import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildExecutionTask } from "@/lib/career-agent-execution";

const actions = new Set(["follow_up", "prepare", "reconnect"]);

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const relationshipKey = typeof body.relationshipKey === "string" ? body.relationshipKey.trim() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "Career relationship";
  const action = typeof body.action === "string" ? body.action : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";

  if (!relationshipKey || !actions.has(action) || !summary) {
    return NextResponse.json({ error: "A valid relationship action is required." }, { status: 400 });
  }

  const operationId = `network:${relationshipKey}:${action}`;
  const { data: existing } = await supabase
    .from("career_execution_tasks")
    .select("id,state")
    .eq("user_id", user.id)
    .eq("operation_id", operationId)
    .in("state", ["queued", "awaiting_approval", "approved", "executing"])
    .maybeSingle();

  if (existing) return NextResponse.json({ task: existing, deduplicated: true });

  const title = action === "prepare"
    ? `Prepare for ${companyName}`
    : action === "reconnect"
      ? `Reconnect with ${companyName}`
      : `Follow up with ${companyName}`;

  const task = buildExecutionTask({
    id: operationId,
    action: action as "follow_up" | "prepare",
    title,
    summary,
    requiresApproval: true,
  });

  const { data, error } = await supabase.from("career_execution_tasks").insert({
    user_id: user.id,
    operation_id: operationId,
    action: task.action,
    state: task.state,
    title: task.title,
    summary: task.summary,
    requires_approval: task.requiresApproval,
    max_attempts: task.maxAttempts,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data, deduplicated: false });
}
