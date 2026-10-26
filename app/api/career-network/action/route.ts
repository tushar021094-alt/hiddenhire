import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildExecutionTask } from "@/lib/career-agent-execution";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const actions = new Set(["follow_up", "prepare", "reconnect"]);

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Career network role lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  }
  if (profile?.role !== "candidate") {
    return NextResponse.json({ error: "Career Network is available only to candidate accounts." }, { status: 403 });
  }

  const rate = checkRateLimit(`career-network-action:${user.id}`, 15, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const body = await request.json().catch(() => ({}));
  const relationshipKey = typeof body.relationshipKey === "string" ? body.relationshipKey.trim() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim().slice(0, 180) : "Career relationship";
  const action = typeof body.action === "string" ? body.action : "";
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 3000) : "";

  if (!relationshipKey || !actions.has(action) || !summary) {
    return NextResponse.json({ error: "A valid relationship action is required." }, { status: 400 });
  }

  const operationId = `network:${relationshipKey}:${action}`;
  const taskAction = action === "follow_up" ? "follow_up" : "prepare";
  const title = action === "prepare"
    ? `Prepare for ${companyName}`
    : action === "reconnect"
      ? `Reconnect with ${companyName}`
      : `Follow up with ${companyName}`;

  const task = buildExecutionTask({
    id: operationId,
    action: taskAction,
    title,
    summary,
    requiresApproval: true,
  });

  const { data, error } = await supabase.rpc("create_career_execution_task", {
    p_action: task.action,
    p_title: task.title,
    p_summary: task.summary,
    p_requires_approval: task.requiresApproval,
    p_application_id: null,
    p_operation_id: operationId,
  });
  if (error) {
    console.error("Career network task RPC failed", { code: error.code });
    return NextResponse.json({ error: "Unable to queue this career action right now." }, { status: 503 });
  }

  const result = data as { ok?: boolean; code?: string; task?: unknown; deduplicated?: boolean } | null;
  if (!result?.ok) {
    return NextResponse.json({ error: "Unable to queue this career action right now." }, { status: result?.code === "FORBIDDEN" ? 403 : 400 });
  }
  return NextResponse.json({ task: result.task, deduplicated: result.deduplicated === true });
}
