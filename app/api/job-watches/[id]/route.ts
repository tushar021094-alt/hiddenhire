import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

const allowedFields = new Set(["name","query","targetRoles","preferredLocations","preferredCountries","skills","minimumSalary","currency","remoteOnly","minMatchScore","enabled"]);

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 20).map((item) => item.trim()) : undefined;
}

export async function PATCH(request: Request, context: Context) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !allowedFields.has(key))) return NextResponse.json({ error: "Unsupported watch field." }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.name === "string") update.name = input.name.trim().slice(0, 100);
  if (typeof input.query === "string") update.query = input.query.trim().slice(0, 500);
  if (arrayValue(input.targetRoles)) update.target_roles = arrayValue(input.targetRoles);
  if (arrayValue(input.preferredLocations)) update.preferred_locations = arrayValue(input.preferredLocations);
  if (arrayValue(input.preferredCountries)) update.preferred_countries = arrayValue(input.preferredCountries);
  if (arrayValue(input.skills)) update.skills = arrayValue(input.skills);
  if (typeof input.minimumSalary === "number") update.minimum_salary = Math.max(0, input.minimumSalary);
  if (typeof input.currency === "string") update.currency = input.currency.trim().slice(0, 8) || "INR";
  if (typeof input.remoteOnly === "boolean") update.remote_only = input.remoteOnly;
  if (typeof input.minMatchScore === "number") update.min_match_score = Math.max(0, Math.min(100, Math.round(input.minMatchScore)));
  if (typeof input.enabled === "boolean") update.enabled = input.enabled;

  const { data, error } = await supabase.from("job_watches").update(update).eq("id", id).eq("candidate_id", user.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update job watch." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Job watch not found." }, { status: 404 });
  return NextResponse.json({ watch: data });
}

export async function DELETE(_request: Request, context: Context) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabase.from("job_watches").delete().eq("id", id).eq("candidate_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to delete job watch." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Job watch not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
