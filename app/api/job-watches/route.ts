import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 16_384;

function cleanStringArray(value: unknown, max = 20) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, max).map((item) => item.trim());
}

async function parseBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return { error: "Request is too large." };
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return { error: "Request is too large." };
  try { return { value: JSON.parse(raw) as unknown }; } catch { return { error: "Invalid JSON body." }; }
}

async function requireCandidate() {
  const result = await getAuthenticatedUser();
  if (result.error || !result.user) return { ...result, response: NextResponse.json({ error: result.error || "Authentication is required." }, { status: 401 }) };
  const { data: profile, error } = await result.supabase.from("profiles").select("role").eq("id", result.user.id).maybeSingle();
  if (error) return { ...result, response: NextResponse.json({ error: "Unable to verify your account." }, { status: 500 }) };
  if (profile?.role !== "candidate") return { ...result, response: NextResponse.json({ error: "Only candidate accounts can manage job watches." }, { status: 403 }) };
  return { ...result, response: null };
}

export async function GET() {
  const auth = await requireCandidate();
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.from("job_watches").select("*").eq("candidate_id", auth.user!.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load job watches." }, { status: 500 });
  return NextResponse.json({ watches: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireCandidate();
  if (auth.response) return auth.response;
  const parsed = await parseBody(request);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const body = parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value) ? parsed.value as Record<string, unknown> : {};
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Watch name is required." }, { status: 400 });

  const minMatchScore = Math.max(0, Math.min(100, Number(body.minMatchScore ?? 70)));
  const payload = {
    candidate_id: auth.user!.id,
    name,
    query: typeof body.query === "string" ? body.query.trim().slice(0, 500) : null,
    target_roles: cleanStringArray(body.targetRoles),
    preferred_locations: cleanStringArray(body.preferredLocations),
    preferred_countries: cleanStringArray(body.preferredCountries),
    skills: cleanStringArray(body.skills),
    minimum_salary: Math.max(0, Number(body.minimumSalary ?? 0)),
    currency: typeof body.currency === "string" ? body.currency.trim().slice(0, 8) || "INR" : "INR",
    remote_only: Boolean(body.remoteOnly),
    min_match_score: Number.isFinite(minMatchScore) ? minMatchScore : 70,
    enabled: body.enabled !== false,
  };

  const { data, error } = await auth.supabase.from("job_watches").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: "Unable to create job watch." }, { status: 500 });
  return NextResponse.json({ watch: data }, { status: 201 });
}
