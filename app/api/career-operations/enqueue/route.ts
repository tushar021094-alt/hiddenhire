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

  const validKinds = ["application_follow_up", "interview_prepare", "application_check", "opportunity_review", "profile_improvement"];
  if (!validKinds.includes(operation.kind)) return NextResponse.json({ error: "Unsupported career operation." }, { status: 400 });

  const action =
    operation.kind === "application_follow_up" ? "follow_up" :
    operation.kind === "interview_prepare" ? "prepare" :
    "review";
  const task = buildExecutionTask({
    id: operation.id,
    action,
    title: operation.title.trim().slice(0, 180),
    summary: operation.summary.trim().slice(0, 3000),
    requiresApproval: typeof operation.requiresApproval === "boolean" ? operation.requiresApproval : true,
  });

  const { data, error } = await supabase.rpc("create_career_execution_task", {
    p_action: task.action,
    p_title: task.title,
    p_summary: task.summary,
    p_requires_approval: task.requiresApproval,
    p_application_id: null,
    p_operation_id: operation.id,
  });
  if (error) {
    console.error("Career operation task RPC failed", { code: error.code });
    return NextResponse.json({ error: "Unable to queue this career operation right now." }, { status: 503 });
  }

  const result = data as { ok?: boolean; code?: string; task?: unknown; deduplicated?: boolean } | null;
  if (!result?.ok) {
    return NextResponse.json({ error: "The career operation details are invalid." }, { status: result?.code === "FORBIDDEN" ? 403 : 400 });
  }
  return NextResponse.json({ task: result.task, deduplicated: result.deduplicated === true, phase: 30 }, { status: result.deduplicated ? 200 : 201 });
}
