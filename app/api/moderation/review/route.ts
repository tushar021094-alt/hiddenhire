import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAppeal } from "@/lib/moderation-appeals";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, allowed: profile?.role === "admin" };
}

export async function GET() {
  const { supabase, allowed } = await adminClient();
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("moderation_appeals").select("id,case_id,job_id,recruiter_id,reason,status,submitted_at,reviewed_at,resolution").order("submitted_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appeals: data ?? [], phase: 29 });
}

export async function PATCH(request: Request) {
  const { supabase, user, allowed } = await adminClient();
  if (!allowed || !user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const appealId = String(body.appealId ?? "");
  const status = body.status === "accepted" || body.status === "rejected" ? body.status : null;
  const resolution = String(body.resolution ?? "").trim();
  if (!appealId || !status || resolution.length < 10) return NextResponse.json({ error: "A decision and at least 10 characters of resolution are required." }, { status: 400 });
  const { data: appeal } = await supabase.from("moderation_appeals").select("id,status").eq("id", appealId).single();
  if (!appeal || !["submitted","under_review"].includes(appeal.status)) return NextResponse.json({ error: "Appeal is not reviewable." }, { status: 409 });
  const { data, error } = await supabase.from("moderation_appeals").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id, resolution }).eq("id", appealId).select("id,status,reviewed_at,resolution").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ appeal: data, phase: 29 });
}
