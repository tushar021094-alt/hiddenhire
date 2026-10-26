import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExecutionTask } from "@/lib/career-agent-execution";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Career task role lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  }
  if (profile?.role !== "candidate") {
    return NextResponse.json({ error: "Career execution is available only to candidate accounts." }, { status: 403 });
  }
  const rate = checkRateLimit(`career-tasks:${user.id}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
  const {data,error}=await supabase.from("career_execution_tasks").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if(error){ console.error("Career task read failed", { code: error.code }); return NextResponse.json({error:"Unable to load career tasks right now."},{status:500}); }
  return NextResponse.json({tasks:data??[],phase:30});
}

export async function POST(request:Request){
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Career task role lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  }
  if (profile?.role !== "candidate") {
    return NextResponse.json({ error: "Career execution is available only to candidate accounts." }, { status: 403 });
  }
  const rate = checkRateLimit(`career-tasks:${user.id}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 16_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  const body = value as Record<string, unknown>;
  const action = body.action === "prepare" || body.action === "follow_up" || body.action === "review" || body.action === "apply"
    ? body.action
    : null;
  if (!action) return NextResponse.json({ error: "Choose a valid career task action." }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "Career agent task";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "Review this career action before execution.";
  if (!title || title.length > 180 || !summary || summary.length > 3000) return NextResponse.json({ error: "Task title or summary is invalid or too long." }, { status: 400 });
  const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  const operationId = typeof body.operationId === "string" ? body.operationId.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (applicationId && !uuidPattern.test(applicationId)) return NextResponse.json({ error: "Application reference is invalid." }, { status: 400 });
  if (applicationId.length > 200 || operationId.length > 200) return NextResponse.json({ error: "Task reference is too long." }, { status: 400 });
  const task = buildExecutionTask({
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim().slice(0, 200) : crypto.randomUUID(),
    action,
    title,
    summary,
    requiresApproval: body.requiresApproval !== false,
  });
  const { data, error } = await supabase.rpc("create_career_execution_task", {
    p_action: task.action,
    p_title: task.title,
    p_summary: task.summary,
    p_requires_approval: task.requiresApproval,
    p_application_id: applicationId || null,
    p_operation_id: operationId || null,
  });
  if (error) {
    console.error("Career task creation RPC failed", { code: error.code });
    return NextResponse.json({ error: "Unable to save the career task right now." }, { status: 503 });
  }
  const result = data as { ok?: boolean; code?: string; task?: unknown; deduplicated?: boolean } | null;
  if (!result?.ok) {
    if (result?.code === "APPLICATION_NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (result?.code === "FORBIDDEN") return NextResponse.json({ error: "Career execution is available only to candidate accounts." }, { status: 403 });
    return NextResponse.json({ error: "The career task details are invalid." }, { status: 400 });
  }
  return NextResponse.json({ task: result.task, deduplicated: result.deduplicated === true, phase: 30 }, { status: result.deduplicated ? 200 : 201 });
}

export async function PATCH(request:Request){
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Career task role lookup failed", { code: profileError.code });
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
  }
  if (profile?.role !== "candidate") {
    return NextResponse.json({ error: "Career execution is available only to candidate accounts." }, { status: 403 });
  }
  const rate = checkRateLimit(`career-tasks:${user.id}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 16_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  const body = value as Record<string, unknown>;
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const event = typeof body.event === "string" ? body.event : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(taskId) || !["approve", "start", "complete", "fail", "cancel"].includes(event)) {
    return NextResponse.json({ error: "Invalid task transition." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("transition_career_execution_task", {
    p_task_id: taskId,
    p_event: event,
  });
  if (error) {
    console.error("Career task transition RPC failed", { code: error.code });
    return NextResponse.json({ error: "Unable to update the career task right now." }, { status: 503 });
  }
  const result = data as { ok?: boolean; code?: string; task?: unknown } | null;
  if (!result?.ok) {
    if (result?.code === "NOT_FOUND") return NextResponse.json({ error: "Task not found." }, { status: 404 });
    if (result?.code === "FORBIDDEN") return NextResponse.json({ error: "Career execution is available only to candidate accounts." }, { status: 403 });
    return NextResponse.json({ error: "That transition is not allowed." }, { status: 409 });
  }
  return NextResponse.json({ task: result.task, phase: 30 });
}
