import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 64_000;

type VerificationEvidence = {
  mobile?: string;
  recruiter_name?: string;
  designation?: string;

  organisation_type?: string;

  company_name?: string;
  company_website?: string;
  company_domain?: string;

  legal_company_name?: string;
  cin?: string;
  llpin?: string;
  company_pan?: string;
  registered_address?: string;

  gst_registered?: string;
  gstin?: string;

  proprietor_name?: string;
  business_trade_name?: string;
  udyam_number?: string;

  business_registration_details?: string;

  additional_business_verification?: string;

  verification_documents?: Array<{
    type: string;
    path: string;
    file_name: string;
    mime_type: string;
    size: number;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_EVIDENCE_FIELD_LENGTH = 500;
const MAX_DOCUMENT_FIELD_LENGTH = 500;

function cleanString(
  value: unknown,
  maxLength = MAX_EVIDENCE_FIELD_LENGTH,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`recruiter-verification:${getClientIdentifier(request)}`, 10, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
  try {
    const { supabase, user, error: authError } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Your HiddenHire profile could not be found." },
        { status: 403 }
      );
    }

    if (profile.role !== "employer" && profile.role !== "agency") {
      return NextResponse.json(
        { error: "Only employers and agencies can request verification." },
        { status: 403 }
      );
    }

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
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (!isRecord(body) || !isRecord(body.evidence)) {
      return NextResponse.json(
        { error: "Verification evidence is required." },
        { status: 400 }
      );
    }

    const raw = body.evidence;

    const oversizedEvidenceField = Object.entries(raw).some(
      ([key, value]) =>
        key !== "verification_documents" &&
        typeof value === "string" &&
        value.trim().length > MAX_EVIDENCE_FIELD_LENGTH,
    );

    if (oversizedEvidenceField) {
      return NextResponse.json(
        { error: "A verification evidence field is too long." },
        { status: 413 },
      );
    }

    if (
      Array.isArray(raw.verification_documents) &&
      raw.verification_documents.length > 5
    ) {
      return NextResponse.json(
        { error: "A maximum of five verification documents can be submitted." },
        { status: 400 },
      );
    }

    const evidence: VerificationEvidence = {
      mobile: cleanString(raw.mobile),
      recruiter_name: cleanString(raw.recruiter_name),
      designation: cleanString(raw.designation),

      organisation_type: cleanString(raw.organisation_type),

      company_name: cleanString(raw.company_name),
      company_website: cleanString(raw.company_website),
      company_domain: cleanString(raw.company_domain),

      legal_company_name: cleanString(raw.legal_company_name),
      cin: cleanString(raw.cin),
      llpin: cleanString(raw.llpin),
      company_pan: cleanString(raw.company_pan),
      registered_address: cleanString(raw.registered_address),

      gst_registered: cleanString(raw.gst_registered),
      gstin: cleanString(raw.gstin),

      proprietor_name: cleanString(raw.proprietor_name),
      business_trade_name: cleanString(raw.business_trade_name),
      udyam_number: cleanString(raw.udyam_number),

      business_registration_details:
        cleanString(raw.business_registration_details),

      additional_business_verification:
        cleanString(raw.additional_business_verification),
    };

    if (Array.isArray(raw.verification_documents)) {
      evidence.verification_documents = raw.verification_documents
        .filter(isRecord)
        .map((document) => ({
          type: cleanString(document.type, MAX_DOCUMENT_FIELD_LENGTH) || "other",
          path: cleanString(document.path, MAX_DOCUMENT_FIELD_LENGTH) || "",
          file_name: cleanString(document.file_name, MAX_DOCUMENT_FIELD_LENGTH) || "",
          mime_type: cleanString(document.mime_type, MAX_DOCUMENT_FIELD_LENGTH) || "",
          size:
            typeof document.size === "number" &&
            Number.isFinite(document.size)
              ? document.size
              : 0,
        }))
        .filter(
          (document) =>
            document.path &&
            document.file_name &&
            document.mime_type &&
            document.size > 0
        );
    }

    const { data: verificationId, error: verificationError } =
      await supabase.rpc("request_recruiter_verification", {
        p_evidence: evidence,
      });

    if (verificationError) {
      return NextResponse.json(
        { error: "Unable to submit the verification request." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      verificationId,
      status: "pending",
    });
  } catch (error) {
    console.error(
      "[recruiter/verification] verification request failed",
      error
    );

    return NextResponse.json(
      { error: "Verification request failed. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { supabase, user, error: authError } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Your HiddenHire profile could not be found." },
        { status: 403 }
      );
    }

    if (profile.role !== "employer" && profile.role !== "agency") {
      return NextResponse.json(
        {
          error:
            "Only employers and agencies have recruiter verification.",
        },
        { status: 403 }
      );
    }

    const { data: verification, error: verificationError } =
      await supabase
        .from("verification_records")
        .select(
          "id, verification_type, status, evidence, reviewed_by, created_at, updated_at"
        )
        .eq("profile_id", user.id)
        .eq("verification_type", "recruiter_verification")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (verificationError) {
      return NextResponse.json(
        { error: "Unable to load verification status." },
        { status: 500 }
      );
    }

    let verified = false;

    if (profile.role === "employer") {
      const { data: employerProfile, error } = await supabase
        .from("employer_profiles")
        .select("recruiter_verified")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Unable to load employer verification status." },
          { status: 500 }
        );
      }

      verified = employerProfile?.recruiter_verified === true;
    } else {
      const { data: agencyProfile, error } = await supabase
        .from("agency_profiles")
        .select("verified")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Unable to load agency verification status." },
          { status: 500 }
        );
      }

      verified = agencyProfile?.verified === true;
    }

    return NextResponse.json({
      verified,
      status: verification?.status ?? "not_submitted",
      verification: verification
        ? {
            id: verification.id,
            verificationType: verification.verification_type,
            status: verification.status,
            createdAt: verification.created_at,
            updatedAt: verification.updated_at,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "[recruiter/verification] verification status failed",
      error
    );

    return NextResponse.json(
      { error: "Unable to load verification status." },
      { status: 500 }
    );
  }
}