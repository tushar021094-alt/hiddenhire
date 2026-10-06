import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  const { id } = await context.params;

  const { data: watch } = await supabase.from("job_watches").select("id").eq("id", id).eq("candidate_id", user.id).maybeSingle();
  if (!watch) return NextResponse.json({ error: "Job watch not found." }, { status: 404 });

  const { data, error } = await supabase.from("job_watch_events")
    .select("id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
    .eq("watch_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Unable to load watch events." }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
