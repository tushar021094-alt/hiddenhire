import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data: watches, error: watchError } = await supabase
    .from("job_watches")
    .select("id,name")
    .eq("candidate_id", user.id)
    .order("created_at", { ascending: false });

  if (watchError) return NextResponse.json({ error: "Unable to load job watches." }, { status: 500 });
  if (!watches?.length) return NextResponse.json({ events: [], watches: [] });

  const watchIds = watches.map((watch) => watch.id);
  const { data: events, error } = await supabase
    .from("job_watch_events")
    .select("id,watch_id,job_fingerprint,event_type,previous_score,current_score,payload,created_at")
    .in("watch_id", watchIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Unable to load Career Agent signals." }, { status: 500 });

  const watchNames = new Map(watches.map((watch) => [watch.id, watch.name]));
  const ranked = (events ?? []).map((event) => ({
    ...event,
    watchName: watchNames.get(event.watch_id) || "Job Watch",
    priority: typeof event.payload?.priority === "number" ? event.payload.priority : 0,
  })).sort((a, b) => {
    const priorityDelta = b.priority - a.priority;
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, 50);

  return NextResponse.json({ events: ranked, watches });
}
