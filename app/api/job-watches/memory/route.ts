import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildOpportunityMemory, type OpportunityMemoryEvent } from "@/lib/opportunity-memory";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { data: watches, error: watchError } = await supabase
    .from("job_watches")
    .select("id,name")
    .eq("candidate_id", user.id);

  if (watchError) return NextResponse.json({ error: "Unable to load opportunity memory." }, { status: 500 });
  if (!watches?.length) return NextResponse.json({ opportunities: [] });

  const watchIds = watches.map((watch) => watch.id);
  const { data: events, error } = await supabase
    .from("job_watch_events")
    .select("id,watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
    .in("watch_id", watchIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: "Unable to load opportunity history." }, { status: 500 });

  const opportunities = buildOpportunityMemory((events ?? []) as OpportunityMemoryEvent[]).slice(0, 40);
  const watchNames = new Map(watches.map((watch) => [watch.id, watch.name]));

  return NextResponse.json({
    opportunities,
    watchCount: watches.length,
    eventCount: events?.length ?? 0,
    watches: watches.map((watch) => ({ id: watch.id, name: watchNames.get(watch.id) })),
  });
}
