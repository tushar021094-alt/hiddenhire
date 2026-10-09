import { NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { growthError, recordGrowthEvent } from "@/lib/growth-server";

const ALLOWED_EVENTS = new Set([
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
]);

const MAX_BODY_BYTES = 8_000;
const MAX_METADATA_KEYS = 20;
const MAX_STRING_LENGTH = 300;

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_STRING_LENGTH) : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_KEYS);
  return Object.fromEntries(
    entries.map(([key, item]) => [
      key.slice(0, 80),
      typeof item === "string" ? item.slice(0, 500) : typeof item === "number" || typeof item === "boolean" ? item : null,
    ]),
  );
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`growth:${getClientIdentifier(request)}`, 60, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const eventName = cleanString(input.eventName);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: "Unsupported event." }, { status: 400 });
    }

    const sessionId = cleanString(input.sessionId);
    if (sessionId && (sessionId.length < 8 || sessionId.length > 128)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 400 });
    }

    await getAuthenticatedUser();

    await recordGrowthEvent({
      eventName,
      sessionId,
      path: cleanString(input.path),
      referrer: cleanString(input.referrer),
      source: cleanString(input.source),
      medium: cleanString(input.medium),
      campaign: cleanString(input.campaign),
      content: cleanString(input.content),
      term: cleanString(input.term),
      metadata: cleanMetadata(input.metadata),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return growthError();
  }
}
