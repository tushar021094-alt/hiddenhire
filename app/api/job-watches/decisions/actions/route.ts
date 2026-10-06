import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data, error } = await supabase
    .from("career_agent_actions")
    .select("id,job_fingerprint,action,decision_score,source_url,job_title,company_name,job_location,workflow,created_at")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Unable to load Career Agent action history." }, { status: 500 });
  return NextResponse.json({ actions: data ?? [] });
}
