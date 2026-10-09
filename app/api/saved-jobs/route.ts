import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_jobs")
    .select("id, profile_id, external_job_id, job_id, source, job_url, score, status, created_at, title, company, location, remote, salary_min, salary_max, currency")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load saved jobs", error);
    return NextResponse.json({ error: "Unable to load saved jobs." }, { status: 500 });
  }
  return NextResponse.json({ savedJobs: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  const source = text(body.source, 80) || "external";
  const id = text(body.id, 300);
  const title = text(body.title, 300);
  if (!id || !title) {
    return NextResponse.json({ error: "Job id and title are required." }, { status: 400 });
  }

  const isNative = source.toLowerCase() === "hiddenhire";
  const row = {
    profile_id: user.id,
    external_job_id: isNative ? null : id,
    job_id: isNative ? id : null,
    source,
    job_url: text(body.applicationUrl, 2000) || null,
    score: typeof body.score === "number" && Number.isFinite(body.score) ? body.score : null,
    title,
    company: text(body.company, 300) || null,
    location: text(body.location, 300) || null,
    remote: typeof body.remote === "boolean" ? body.remote : null,
    salary_min: typeof body.salaryMin === "number" ? body.salaryMin : null,
    salary_max: typeof body.salaryMax === "number" ? body.salaryMax : null,
    currency: text(body.currency, 12) || null,
    status: "saved",
  };

  const conflict = isNative ? "profile_id,job_id" : "profile_id,external_job_id";
  const { data, error } = await supabase
    .from("saved_jobs")
    .upsert(row, { onConflict: conflict })
    .select("id, profile_id, external_job_id, job_id, source, job_url, score, status, created_at, title, company, location, remote, salary_min, salary_max, currency")
    .single();

  if (error) {
    console.error("Unable to save job", error);
    return NextResponse.json({ error: "Unable to save this job right now." }, { status: 500 });
  }
  return NextResponse.json({ success: true, savedJob: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  const source = text(body.source, 80) || "external";
  const id = text(body.id, 300);
  if (!id) return NextResponse.json({ error: "Job id is required." }, { status: 400 });

  let query = supabase.from("saved_jobs").delete().eq("profile_id", user.id);
  query = source.toLowerCase() === "hiddenhire"
    ? query.eq("job_id", id)
    : query.eq("external_job_id", id);

  const { error } = await query;
  if (error) {
    console.error("Unable to remove saved job", error);
    return NextResponse.json({ error: "Unable to remove this saved job." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
