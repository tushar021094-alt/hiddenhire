import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const STATUSES = new Set(["open", "completed", "dismissed"]);

export async function PATCH(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "A task payload is required." }, { status: 400 });

  const value = body as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const taskStatus = typeof value.taskStatus === "string" ? value.taskStatus.trim() : "";
  if (!id || !STATUSES.has(taskStatus)) return NextResponse.json({ error: "id and a valid taskStatus are required." }, { status: 400 });

  const { data, error } = await supabase
    .from("career_agent_actions")
    .update({ task_status: taskStatus, completed_at: taskStatus === "completed" ? new Date().toISOString() : null, due_at: taskStatus === "open" ? undefined : null })
    .eq("id", id)
    .eq("candidate_id", user.id)
    .select("id,job_fingerprint,action,task_status,completed_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Unable to update this Career Agent task." }, { status: 404 });
  return NextResponse.json({ success: true, task: data });
}
