import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EVENT_NAMES = [
  "landing_view",
  "search_started",
  "auth_prompt_shown",
  "match_results_viewed",
  "application_click",
  "signup_started",
  "signup_completed",
  "login_completed",
  "job_post_started",
  "job_post_completed",
] as const;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("growth_events")
    .select("event_name, session_id, profile_id, source, medium, campaign, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20_000);

  if (error) return NextResponse.json({ error: "Growth data unavailable." }, { status: 503 });

  const byEvent = Object.fromEntries(
    EVENT_NAMES.map(name => [name, 0]),
  ) as Record<(typeof EVENT_NAMES)[number], number>;

  const sessions = new Set<string>();
  const profiles = new Set<string>();
  const sources = new Map<string, number>();

  for (const event of events ?? []) {
    if (event.event_name in byEvent) {
      byEvent[event.event_name as keyof typeof byEvent] += 1;
    }
    if (event.session_id) sessions.add(event.session_id);
    if (event.profile_id) profiles.add(event.profile_id);
    if (event.source) sources.set(event.source, (sources.get(event.source) ?? 0) + 1);
  }

  const topSources = [...sources.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, count]) => ({ source, count }));

  const searches = byEvent.search_started;
  const applications = byEvent.application_click;
  const signupStarts = byEvent.signup_started;
  const signupCompletions = byEvent.signup_completed;

  return NextResponse.json({
    windowDays: days,
    generatedAt: new Date().toISOString(),
    totals: {
      events: events?.length ?? 0,
      uniqueSessions: sessions.size,
      identifiedProfiles: profiles.size,
    },
    funnel: {
      landingViews: byEvent.landing_view,
      searchStarted: searches,
      applicationClicks: applications,
      signupStarted: signupStarts,
      signupCompleted: signupCompletions,
      searchToApplicationRate: searches ? Number((applications / searches * 100).toFixed(1)) : 0,
      signupCompletionRate: signupStarts ? Number((signupCompletions / signupStarts * 100).toFixed(1)) : 0,
    },
    byEvent,
    topSources,
  });
}
