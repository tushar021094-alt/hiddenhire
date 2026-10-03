import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type VerificationDocument = {
  type?: string;
  path?: string;
  file_name?: string;
  mime_type?: string;
  size?: number;
};

type QueueRow = {
  verification_id: string;
  profile_id: string;
  company_id: string | null;
  verification_type: string;
  verification_status: string;
  created_at: string;
  updated_at: string;

  requester_role: string | null;
  recruiter_designation: string | null;
  agency_name: string | null;
  recruiter_verified: boolean;
  agency_verified: boolean;

  company_name: string | null;
  company_website: string | null;
  company_email_domain: string | null;
  company_country: string | null;
  company_verification_status: string | null;

  evidence: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRow(value: unknown): QueueRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value as QueueRow[];
}

export async function GET() {
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

    const { data, error } = await supabase.rpc(
      "admin_recruiter_verification_queue",
    );

    if (error) {
      return NextResponse.json(
        { error: "Unable to load recruiter verification queue." },
        { status: 500 },
      );
    }

    const rows = firstRow(data);

    const verifications = await Promise.all(
      rows.map(async (row) => {
        const evidence = isRecord(row.evidence)
          ? row.evidence
          : {};

        const rawDocuments = Array.isArray(
          evidence.verification_documents,
        )
          ? evidence.verification_documents
          : [];

        const documents = await Promise.all(
          rawDocuments
            .filter(isRecord)
            .map(async (document) => {
              const typedDocument = document as VerificationDocument;

              const path =
                typeof typedDocument.path === "string"
                  ? typedDocument.path
                  : "";

              let signedUrl: string | null = null;

              if (path) {
                const { data: signedUrlData } =
                  await supabase.storage
                    .from("verification-documents")
                    .createSignedUrl(path, 15 * 60);

                signedUrl = signedUrlData?.signedUrl ?? null;
              }

              return {
                type:
                  typeof typedDocument.type === "string"
                    ? typedDocument.type
                    : "other",
                fileName:
                  typeof typedDocument.file_name === "string"
                    ? typedDocument.file_name
                    : "document",
                mimeType:
                  typeof typedDocument.mime_type === "string"
                    ? typedDocument.mime_type
                    : null,
                size:
                  typeof typedDocument.size === "number"
                    ? typedDocument.size
                    : null,
                signedUrl,
              };
            }),
        );

        const {
          verification_documents: _verificationDocuments,
          ...safeEvidence
        } = evidence;

        return {
          id: row.verification_id,
          profileId: row.profile_id,
          companyId: row.company_id,
          verificationType: row.verification_type,
          status: row.verification_status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,

          requester: {
            id: row.profile_id,
            role: row.requester_role,
            designation: row.recruiter_designation,
            recruiterVerified: row.recruiter_verified,
            agencyName: row.agency_name,
            agencyVerified: row.agency_verified,
          },

          company: row.company_id
            ? {
                id: row.company_id,
                name: row.company_name,
                website: row.company_website,
                emailDomain: row.company_email_domain,
                country: row.company_country,
                verificationStatus: row.company_verification_status,
              }
            : null,

          evidence: safeEvidence,
          documents,
        };
      }),
    );

    return NextResponse.json({
      verifications,
    });
  } catch (error) {
    console.error(
      "[admin/recruiter-verifications/pending] failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load recruiter verification queue. Please try again.",
      },
      { status: 500 },
    );
  }
}
