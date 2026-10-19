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

  if (error) { console.error("Career network task creation failed", { code: error.code }); return NextResponse.json({ error: "Unable to queue this career action right now." }, { status: 500 }); }
  return NextResponse.json({ task: data, deduplicated: false });
}
