import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type ReviewAction = "approve" | "reject";

function isReviewAction(value: unknown): value is ReviewAction {
  return value === "approve" || value === "reject";
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error: authError } =
      await getAuthenticatedUser();

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
      return NextResponse.json(
        { error: "Unable to verify admin access." },
        { status: 500 },
      );
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "A valid review request is required." },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;

    const verificationId =
      typeof payload.verificationId === "string"
        ? payload.verificationId.trim()
        : "";

    const action = payload.action;
    const reason =
      typeof payload.reason === "string"
        ? payload.reason.trim()
        : "";

    if (!verificationId) {
      return NextResponse.json(
        { error: "Verification ID is required." },
        { status: 400 },
      );
    }

    if (!isReviewAction(action)) {
      return NextResponse.json(
        { error: "Review action must be approve or reject." },
        { status: 400 },
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { error: "A rejection reason is required." },
        { status: 400 },
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        {
          error:
            "The verification review reason cannot exceed 500 characters.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc(
      "admin_review_recruiter_verification",
      {
        p_verification_id: verificationId,
        p_action: action,
        p_reason: reason || null,
      },
    );

    if (error) {
      console.error(
        "[admin/recruiter-verifications/review] rpc failed",
        error,
      );

      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      verificationId:
        result?.verification_id ?? verificationId,
      status: result?.verification_status ?? null,
      reviewedBy: result?.reviewed_by ?? user.id,
      auditEventId: result?.audit_event_id ?? null,
      action,
    });
  } catch (error) {
    console.error(
      "[admin/recruiter-verifications/review] failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to complete recruiter verification review. Please try again.",
      },
      { status: 500 },
    );
  }
}
