import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FUNNEL = [
  "landing_view",
  "search_started",
  "match_results_viewed",
  "application_click",
  "signup_started",
  "signup_completed",
  "job_post_started",
  "job_post_completed",
] as const;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = Number.isFinite(requestedDays) ? Math.max(7, Math.min(90, Math.floor(requestedDays))) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("growth_events")
    .select("event_name,session_id,profile_id,path,source,medium,campaign,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return NextResponse.json({ error: "Unable to load growth analytics." }, { status: 500 });

  const rows = events ?? [];
  const eventCounts = new Map<string, number>();
  const uniqueSessions = new Map<string, Set<string>>();
  const sources = new Map<string, number>();
  const daily = new Map<string, number>();

  for (const event of rows) {
    const name = String(event.event_name);
    eventCounts.set(name, (eventCounts.get(name) ?? 0) + 1);
    if (!uniqueSessions.has(name)) uniqueSessions.set(name, new Set());
    const identity = event.session_id || event.profile_id;
    if (identity) uniqueSessions.get(name)?.add(identity);
    const source = [event.source, event.medium].filter(Boolean).join(" / ") || "Direct / unknown";
    sources.set(source, (sources.get(source) ?? 0) + 1);
    const day = String(event.created_at).slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }

  const funnel = FUNNEL.map((eventName) => ({
    eventName,
    events: eventCounts.get(eventName) ?? 0,
    uniqueActors: uniqueSessions.get(eventName)?.size ?? 0,
  }));
  const landing = funnel.find((item) => item.eventName === "landing_view")?.events ?? 0;
  const signup = funnel.find((item) => item.eventName === "signup_completed")?.events ?? 0;

  return NextResponse.json({
    days,
    since,
    totals: {
      events: rows.length,
      trackedEventTypes: eventCounts.size,
      uniqueSessions: new Set(rows.map((event) => event.session_id).filter(Boolean)).size,
      signupCompletionRate: landing ? Math.round((signup / landing) * 1000) / 10 : null,
    },
    funnel,
    topEvents: [...eventCounts].map(([eventName, count]) => ({ eventName, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    sources: [...sources].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    daily: [...daily].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    truncated: rows.length === 10000,
    generatedAt: new Date().toISOString(),
  });
}
