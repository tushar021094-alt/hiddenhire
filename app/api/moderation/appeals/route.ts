import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSubmitAppeal, validateAppealReason } from "@/lib/moderation-appeals";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const caseId = String(body.caseId ?? "");
  const validation = validateAppealReason(String(body.reason ?? ""));
  if (!caseId || !validation.valid) return NextResponse.json({ error: validation.error ?? "Invalid appeal." }, { status: 400 });

  const { data: moderationCase } = await supabase
    .from("moderation_cases")
    .select("id,job_id,recruiter_id,status,decision")
    .eq("id", caseId)
    .eq("recruiter_id", user.id)
    .single();
  if (!moderationCase) return NextResponse.json({ error: "Moderation case not found." }, { status: 404 });

  const { data: existing } = await supabase
    .from("moderation_appeals")
    .select("status")
    .eq("case_id", caseId)
    .in("status", ["submitted","under_review"])
    .maybeSingle();

  if (!canSubmitAppeal({ caseStatus: moderationCase.status, decision: moderationCase.decision, existingAppealStatus: existing?.status ?? null })) {
    return NextResponse.json({ error: "This case is not currently eligible for another appeal." }, { status: 409 });
  }

  const { data, error } = await supabase.from("moderation_appeals").insert({
    case_id: caseId, job_id: moderationCase.job_id, recruiter_id: user.id, reason: validation.reason,
  }).select("id,status,submitted_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ appeal: data, phase: 29 });
}
