import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildExecutionTask } from "@/lib/career-agent-execution";
import type { CareerOperation } from "@/lib/career-operations";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Career operations role lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  }
  if (profile?.role !== "candidate") {
    return NextResponse.json({ error: "Career Operations is available only to candidate accounts." }, { status: 403 });
  }

  const rate = checkRateLimit(`career-operation-enqueue:${user.id}`, 20, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const body = await request.json().catch(() => ({}));
  const operation = body && typeof body === "object" && !Array.isArray(body)
    ? (body.operation as Partial<CareerOperation> | undefined)
    : undefined;
  if (
    !operation ||
    typeof operation.id !== "string" || !operation.id.trim() || operation.id.length > 200 ||
    typeof operation.title !== "string" || !operation.title.trim() || operation.title.length > 180 ||
    typeof operation.summary !== "string" || !operation.summary.trim() || operation.summary.length > 3000 ||
    typeof operation.kind !== "string"
  ) {
    return NextResponse.json({ error: "A valid career operation is required." }, { status: 400 });
  }

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

  if (error) { console.error("Career operation task creation failed", { code: error.code }); return NextResponse.json({ error: "Unable to queue this career operation right now." }, { status: 500 }); }
  return NextResponse.json({ task: data, deduplicated: false, phase: 30 });
}
