import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import {
  assessModerationEligibility,
  moderationErrorBody,
  moderationHttpStatusFor,
  parseModerationRequest,
  type ModeratableJobRow,
} from "@/lib/moderation";

export const runtime = "nodejs";

/**
 * POST /api/admin/jobs/moderate
 * Body: { jobId: string, action: "publish" | "reject", reason?: string }
 *
 * Publishes or rejects one pending_review native job. Admin-only:
 *   * the caller must be authenticated,
 *   * the role is read from public.profiles for that authenticated session
 *     (never from the request body),
 *   * public.admin_publish_job / public.admin_reject_job re-check the role
 *     database-side and are the only writers of the jobs status transition,
 *     moderation_events and audit_events.
 */

const MODERATION_JOB_COLUMNS =
  "id, source_type, status, country, title, description";

type ModerationRpcRow = {
  job_id: string | null;
  job_status: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  validity_days?: number | null;
  plan_id?: string | null;
  rejection_reason?: string | null;
  moderation_event_id: string | null;
  audit_event_id: string | null;
};

function firstRow(data: unknown): ModerationRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as ModerationRpcRow | undefined) ?? null;
  }

  return (data as ModerationRpcRow | null) ?? null;
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[admin/jobs/moderate] profile lookup failed", profileError);
      return NextResponse.json({ error: "Unable to verify admin access." }, { status: 500 });
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access is required to moderate jobs." },
        { status: 403 },
      );
    }

    let body: unknown = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const parsed = parseModerationRequest(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { jobId, action, reason } = parsed.request;

    // Pre-flight read so an unusable target fails fast and predictably. The
    // database RPC re-validates every rule and remains the authority.
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(MODERATION_JOB_COLUMNS)
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("[admin/jobs/moderate] job lookup failed", jobError);
      return NextResponse.json({ error: "Unable to load the requested job." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json(
        { error: "The requested job could not be found." },
        { status: 404 },
      );
    }

    const eligibility = assessModerationEligibility(
      job as ModeratableJobRow,
      action,
    );

    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: 400 });
    }

    if (action === "publish") {
      const { data, error } = await supabase.rpc("admin_publish_job", {
        p_job_id: jobId,
      });

      if (error) {
        return NextResponse.json(
          moderationErrorBody(error, "Unable to publish this job."),
          { status: moderationHttpStatusFor(error) },
        );
      }

      const moderation = firstRow(data);

      return NextResponse.json({
        success: true,
        action,
        jobId: moderation?.job_id ?? jobId,
        jobStatus: moderation?.job_status ?? null,
        publishedAt: moderation?.published_at ?? null,
        expiresAt: moderation?.expires_at ?? null,
        validityDays: moderation?.validity_days ?? null,
        planId: moderation?.plan_id ?? null,
        rejectionReason: null,
        moderationEventId: moderation?.moderation_event_id ?? null,
        auditEventId: moderation?.audit_event_id ?? null,
      });
    }

    const { data, error } = await supabase.rpc("admin_reject_job", {
      p_job_id: jobId,
      p_reason: reason,
    });

    if (error) {
      return NextResponse.json(
        moderationErrorBody(error, "Unable to reject this job."),
        { status: moderationHttpStatusFor(error) },
      );
    }

    const moderation = firstRow(data);

    return NextResponse.json({
      success: true,
      action,
      jobId: moderation?.job_id ?? jobId,
      jobStatus: moderation?.job_status ?? null,
      publishedAt: null,
      expiresAt: null,
      validityDays: null,
      planId: null,
      rejectionReason: moderation?.rejection_reason ?? reason,
      moderationEventId: moderation?.moderation_event_id ?? null,
      auditEventId: moderation?.audit_event_id ?? null,
    });
  } catch (error) {
    console.error("[admin/jobs/moderate] job moderation failed", error);

    return NextResponse.json(
      { error: "Job moderation failed. Please try again." },
      { status: 500 },
    );
  }
}