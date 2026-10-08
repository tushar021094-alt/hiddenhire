import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildExecutionTask } from "@/lib/career-agent-execution";
import type { CareerOperation } from "@/lib/career-operations";

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const operation = body.operation as CareerOperation | undefined;
  if (!operation?.id || !operation.title) return NextResponse.json({ error: "A valid career operation is required." }, { status: 400 });

  const action =
    operation.kind === "application_follow_up" ? "follow_up" :
    operation.kind === "interview_prepare" ? "prepare" :
    operation.kind === "profile_improvement" ? "review" :
    operation.kind === "opportunity_review" ? "review" : "review";

  const task = buildExecutionTask({
    id: operation.id,
    action,
    title: operation.title,
    summary: operation.summary,
    requiresApproval: operation.requiresApproval,
  });

  const { data: existing } = await supabase
    .from("career_execution_tasks")
    .select("id,state")
    .eq("user_id", user.id)
    .eq("operation_id", operation.id)
    .in("state", ["queued","awaiting_approval","approved","executing"])
    .maybeSingle();

  if (existing) return NextResponse.json({ task: existing, deduplicated: true, phase: 30 });

  const { data, error } = await supabase.from("career_execution_tasks").insert({
    user_id: user.id,
    operation_id: operation.id,
    action: task.action,
    state: task.state,
    title: task.title,
    summary: task.summary,
    requires_approval: task.requiresApproval,
    max_attempts: task.maxAttempts,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data, deduplicated: false, phase: 30 });
}
