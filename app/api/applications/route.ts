import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 8_192;

async function readJsonBody(request: Request): Promise<{ value?: unknown; response?: Response }> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ error: "Request is too large." }, { status: 413 }) };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return { response: NextResponse.json({ error: "Request is too large." }, { status: 413 }) };
  }

  try {
    return { value: JSON.parse(rawBody) };
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }
}

export async function GET() {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();

    if (authError || !user) {
      return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
    }

    const { data: applications, error } = await supabase
      .from("applications")
      .select(
        "id, job_id, status, created_at, updated_at, candidate_reminder_count, last_candidate_reminder_at, recruiter_response_due_at, jobs!inner(id, title, company_id, location, city, region, country, remote, salary_min, salary_max, currency, source_type, companies(name))",
      )
      .eq("candidate_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load applications", error);
      return NextResponse.json({ error: "Unable to load your applications." }, { status: 500 });
    }

    return NextResponse.json({ applications: applications ?? [] });
  } catch (error) {
    console.error("Application list error", error);
    return NextResponse.json({ error: "Unable to load your applications." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();

    if (authError || !user) {
      return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
    }

    if (profile?.role !== "candidate") {
      return NextResponse.json({ error: "Only candidate accounts can apply to jobs." }, { status: 403 });
    }

    const parsed = await readJsonBody(request);
    if (parsed.response) return parsed.response;
    const body = parsed.value;
    const jobId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { jobId?: unknown }).jobId === "string"
      ? (body as { jobId: string }).jobId.trim()
      : "";

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, source_type, status")
      .eq("id", jobId)
      .eq("source_type", "native")
      .eq("status", "published")
      .maybeSingle();

    if (jobError) {
      return NextResponse.json({ error: "Unable to load the requested job." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "This job is not available for applications." }, { status: 404 });
    }

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .insert({ job_id: job.id, candidate_id: user.id, status: "applied" })
      .select("id, job_id, candidate_id, status, created_at")
      .single();

    if (applicationError) {
      if (applicationError.code === "23505") {
        return NextResponse.json({ error: "You have already applied to this job." }, { status: 409 });
      }
      return NextResponse.json({ error: "Unable to submit the application." }, { status: 500 });
    }

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (error) {
    console.error("Application error", error);
    return NextResponse.json({ error: "Unable to submit application." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();

    if (authError || !user) {
      return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
    }

    const parsed = await readJsonBody(request);
    if (parsed.response) return parsed.response;
    const body = parsed.value;

    const applicationId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { applicationId?: unknown }).applicationId === "string"
      ? (body as { applicationId: string }).applicationId.trim()
      : "";

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const action = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { action?: unknown }).action === "string"
      ? (body as { action: string }).action.trim().toLowerCase()
      : "";

    if (profile?.role === "candidate" && action === "remind") {
      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .select("id, job_id, candidate_id, status, created_at, candidate_reminder_count, last_candidate_reminder_at, recruiter_response_due_at, jobs!inner(id, title, source_type, status, posted_by)")
        .eq("id", applicationId)
        .eq("candidate_id", user.id)
        .maybeSingle();

      if (applicationError) {
        return NextResponse.json({ error: "Unable to load the application." }, { status: 500 });
      }

      if (!application) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }

      if (!["applied", "reviewing", "shortlisted"].includes(application.status)) {
        return NextResponse.json({ error: "A reminder is only available while the application is awaiting a recruiter decision." }, { status: 409 });
      }

      const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
      if (job?.source_type !== "native" || job?.status !== "published" || !job?.posted_by) {
        return NextResponse.json({ error: "This application is not managed by a HiddenHire recruiter or agency." }, { status: 409 });
      }

      const now = Date.now();
      const lastReminder = application.last_candidate_reminder_at
        ? new Date(application.last_candidate_reminder_at).getTime()
        : 0;
      const nextEligible = lastReminder ? lastReminder + 3 * 86_400_000 : 0;

      if (nextEligible > now) {
        return NextResponse.json({
          error: "A reminder was already sent recently.",
          nextEligibleAt: new Date(nextEligible).toISOString(),
        }, { status: 429 });
      }

      const dueAt = new Date(now + 3 * 86_400_000).toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("applications")
        .update({
          candidate_reminder_count: (application.candidate_reminder_count ?? 0) + 1,
          last_candidate_reminder_at: new Date(now).toISOString(),
          recruiter_response_due_at: dueAt,
        })
        .eq("id", applicationId)
        .eq("candidate_id", user.id)
        .select("id, status, candidate_reminder_count, last_candidate_reminder_at, recruiter_response_due_at")
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Unable to send the recruiter reminder." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        reminder: updated,
        message: "Reminder sent. The recruiter or agency has been asked to update the application.",
      });
    }

    const status = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { status?: unknown }).status === "string"
      ? (body as { status: string }).status.trim().toLowerCase()
      : "";

    if (!applicationId || !status) {
      return NextResponse.json({ error: "applicationId and status are required." }, { status: 400 });
    }

    const recruiterStatuses = ["reviewing", "shortlisted", "interview", "rejected", "hired"];

    if ((profile?.role === "employer" || profile?.role === "agency") && recruiterStatuses.includes(status)) {
      const { data: application, error: updateError } = await supabase
        .from("applications")
        .update({ status, recruiter_response_due_at: null })
        .eq("id", applicationId)
        .select("id, job_id, candidate_id, status, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Unable to update the application status." }, { status: 500 });
      }

      return NextResponse.json({ success: true, application });
    }

    if (profile?.role === "candidate" && status === "withdrawn") {
      const { data: application, error: updateError } = await supabase
        .from("applications")
        .update({ status: "withdrawn" })
        .eq("id", applicationId)
        .select("id, job_id, candidate_id, status, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Unable to update the application status." }, { status: 500 });
      }

      return NextResponse.json({ success: true, application });
    }

    return NextResponse.json({ error: "You are not allowed to set this application status." }, { status: 403 });
  } catch (error) {
    console.error("Application status update error", error);
    return NextResponse.json({ error: "Unable to update application status." }, { status: 500 });
  }
}
