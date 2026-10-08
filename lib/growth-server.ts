import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type GrowthEventInput = {
  eventName: string;
  sessionId?: string | null;
  path?: string | null;
  referrer?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordGrowthEvent(event: GrowthEventInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("growth_events").insert({
    event_name: event.eventName,
    profile_id: user?.id ?? null,
    session_id: event.sessionId ?? null,
    path: event.path ?? null,
    referrer: event.referrer ?? null,
    source: event.source ?? null,
    medium: event.medium ?? null,
    campaign: event.campaign ?? null,
    content: event.content ?? null,
    term: event.term ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) throw new Error("Growth event write failed.");
}

export function growthError(message = "Unable to record growth event.") {
  return NextResponse.json({ error: message }, { status: 503 });
}
