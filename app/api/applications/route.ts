import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { supabase, user, error: authError } =
      await getAuthenticatedUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    if (profile?.role !== "candidate") {
      return NextResponse.json(
        { error: "Only candidate accounts can apply to jobs." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const jobId =
      body && typeof body.jobId === "string" ? body.jobId.trim() : "";

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required." },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, source_type, status")
      .eq("id", jobId)
      .eq("source_type", "native")
      .eq("status", "published")
      .maybeSingle();

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 500 },
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "This job is not available for applications." },
        { status: 404 },
      );
    }

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .insert({
        job_id: job.id,
        candidate_id: user.id,
        status: "applied",
      })
      .select("id, job_id, candidate_id, status, created_at")
      .single();

    if (applicationError) {
      if (applicationError.code === "23505") {
        return NextResponse.json(
          { error: "You have already applied to this job." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: applicationError.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        application,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Application error", error);

    return NextResponse.json(
      { error: "Unable to submit application." },
      { status: 500 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const { supabase, user, error: authError } =
      await getAuthenticatedUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    const body = await request.json();

    const applicationId =
      body && typeof body.applicationId === "string"
        ? body.applicationId.trim()
        : "";

    const status =
      body && typeof body.status === "string"
        ? body.status.trim().toLowerCase()
        : "";

    if (!applicationId || !status) {
      return NextResponse.json(
        { error: "applicationId and status are required." },
        { status: 400 },
      );
    }

    const recruiterStatuses = [
      "reviewing",
      "shortlisted",
      "interview",
      "rejected",
      "hired",
    ];

    if (
      (profile?.role === "employer" || profile?.role === "agency") &&
      recruiterStatuses.includes(status)
    ) {
      const { data: application, error: updateError } = await supabase
        .from("applications")
        .update({ status })
        .eq("id", applicationId)
        .select("id, job_id, candidate_id, status, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        application,
      });
    }

    if (profile?.role === "candidate" && status === "withdrawn") {
      const { data: application, error: updateError } = await supabase
        .from("applications")
        .update({ status: "withdrawn" })
        .eq("id", applicationId)
        .select("id, job_id, candidate_id, status, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        application,
      });
    }

    return NextResponse.json(
      { error: "You are not allowed to set this application status." },
      { status: 403 },
    );
  } catch (error) {
    console.error("Application status update error", error);

    return NextResponse.json(
      { error: "Unable to update application status." },
      { status: 500 },
    );
  }
}