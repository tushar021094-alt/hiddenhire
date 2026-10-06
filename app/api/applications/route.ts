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
        "id, job_id, status, created_at, updated_at, jobs!inner(id, title, company_id, location, city, region, country, remote, salary_min, salary_max, currency, source_type, companies(name))",
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
        .update({ status })
        .eq("id", applicationId)
        .select("id, job_id, candidate_id, status, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json({ error: "Unable to update the application status." }, { status: 500 });
      }

      if (profile?.role === "employer" || profile?.role === "agency") {
        await supabase.from("notifications").insert({
          profile_id: application.candidate_id,
          type: `application_status_${status}`,
          title: `Application status updated`,
          body: `Your application has moved to ${status}.`,
          data: { applicationId: application.id, jobId: application.job_id, status },
        });
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
