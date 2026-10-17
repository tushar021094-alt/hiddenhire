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
  if (isNative && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "A valid HiddenHire job id is required." }, { status: 400 });
  }

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
    salary_min: typeof body.salaryMin === "number" && Number.isFinite(body.salaryMin) ? body.salaryMin : null,
    salary_max: typeof body.salaryMax === "number" && Number.isFinite(body.salaryMax) ? body.salaryMax : null,
    currency: text(body.currency, 12) || null,
    status: "saved",
  };

  const { data, error } = await supabase.rpc("save_job_with_entitlement", {
    p_job: row,
    p_is_native: isNative,
  });

  if (error) {
    console.error("Unable to save job", error);
    return NextResponse.json({ error: "Unable to save this job right now." }, { status: 500 });
  }
  if (data?.forbidden) {
    return NextResponse.json({ error: "Only candidate accounts can save jobs." }, { status: 403 });
  }
  if (data?.limitReached) {
    return NextResponse.json({
      error: "You have reached the 10 saved-job limit on the free plan. Upgrade to Candidate Plus to save more jobs.",
      code: "SAVED_JOB_LIMIT_REACHED",
      limit: data.limit,
      used: data.used,
    }, { status: 403 });
  }
  if (!data?.savedJob) {
    return NextResponse.json({ error: "Unable to save this job right now." }, { status: 500 });
  }
  const saved = data.savedJob as Record<string, unknown>;
  const savedJob = {
    id: saved.id,
    profile_id: saved.profile_id,
    external_job_id: saved.external_job_id,
    job_id: saved.job_id,
    source: saved.source,
    job_url: saved.job_url,
    score: saved.score,
    status: saved.status,
    created_at: saved.created_at,
    title: saved.title,
    company: saved.company,
    location: saved.location,
    remote: saved.remote,
    salary_min: saved.salary_min,
    salary_max: saved.salary_max,
    currency: saved.currency,
  };
  return NextResponse.json({ success: true, savedJob }, { status: data.created ? 201 : 200 });
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
