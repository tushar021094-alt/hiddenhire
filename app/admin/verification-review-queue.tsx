"use client";

import { useEffect, useState } from "react";

type DocumentItem = {
  type: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  signedUrl: string | null;
};

type Verification = {
  id: string;
  profileId: string;
  companyId: string | null;
  verificationType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  requester: {
    role: string | null;
    designation: string | null;
    recruiterVerified: boolean;
    agencyName: string | null;
    agencyVerified: boolean;
  };
  company: {
    id: string;
    name: string | null;
    website: string | null;
    emailDomain: string | null;
    country: string | null;
    verificationStatus: string | null;
  } | null;
  evidence: Record<string, unknown>;
  documents: DocumentItem[];
};

function displayValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Not provided";
  }

  return value;
}

export default function VerificationReviewQueue() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadVerifications() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/recruiter-verifications/pending",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load verification queue.",
        );
      }

      setVerifications(
        Array.isArray(data.verifications)
          ? data.verifications
          : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load verification queue.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadVerifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function reviewVerification(
    verificationId: string,
    action: "approve" | "reject",
  ) {
    setActionId(verificationId);
    setError("");
    setSuccess("");

    try {
      let reason = "";

      if (action === "reject") {
        reason =
          window.prompt(
            "Enter the reason for rejecting this recruiter verification:",
          )?.trim() || "";

        if (!reason) {
          setActionId(null);
          return;
        }
      }

      const response = await fetch(
        "/api/admin/recruiter-verifications/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            verificationId,
            action,
            ...(reason ? { reason } : {}),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Verification review failed.",
        );
      }

      setSuccess(
        action === "approve"
          ? "Recruiter verification approved."
          : "Recruiter verification rejected.",
      );

      await loadVerifications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification review failed.",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
            Recruiter verification
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Review recruiter accounts
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Review recruiter identity, business details and supporting
            documents before allowing native HiddenHire job posting.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadVerifications()}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-sm text-white/50">
          Loading recruiter verification queue...
        </div>
      ) : verifications.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
          <h3 className="text-xl font-semibold">
            No recruiter verifications awaiting review
          </h3>

          <p className="mt-2 text-sm text-white/50">
            The verification queue is currently clear.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {verifications.map((verification) => {
            const busy = actionId === verification.id;
            const evidence = verification.evidence;
            const documents = verification.documents;

            return (
              <article
                key={verification.id}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-yellow-300/20 bg-yellow-300/5 px-3 py-1 text-xs text-yellow-200">
                        Pending verification
                      </span>

                      {verification.requester.role ? (
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">
                          {verification.requester.role}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-2xl font-semibold">
                      {displayValue(
                        evidence.recruiter_name,
                      )}
                    </h3>

                    <p className="mt-1 text-sm text-white/50">
                      {displayValue(
                        evidence.designation,
                      )}
                    </p>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Company
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.company_name,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Organisation type
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.organisation_type,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Mobile
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.mobile,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Legal company name
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.legal_company_name,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          PAN
                        </p>
                        <p className="mt-1 text-sm font-mono text-white/75">
                          {displayValue(
                            evidence.company_pan,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          CIN / LLPIN
                        </p>
                        <p className="mt-1 text-sm font-mono text-white/75">
                          {displayValue(
                            evidence.cin ||
                              evidence.llpin,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          GST
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.gstin ||
                              evidence.gst_registered,
                          )}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Registered / business address
                        </p>
                        <p className="mt-1 text-sm text-white/75">
                          {displayValue(
                            evidence.registered_address,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Website
                        </p>

                        <p className="mt-2 break-all text-sm text-white/70">
                          {displayValue(
                            evidence.company_website,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Email domain
                        </p>

                        <p className="mt-2 break-all text-sm text-white/70">
                          {displayValue(
                            evidence.company_domain,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                        Supporting documents
                      </p>

                      {documents.length === 0 ? (
                        <p className="mt-3 text-sm text-red-200">
                          No documents attached.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {documents.map((document) => (
                            <div
                              key={document.fileName}
                              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-white">
                                  {document.fileName}
                                </p>

                                <p className="mt-1 text-xs text-white/40">
                                  {document.mimeType ||
                                    "Unknown type"}
                                  {document.size != null
                                    ? ` · ${(document.size / 1024 / 1024).toFixed(2)} MB`
                                    : ""}
                                </p>
                              </div>

                              {document.signedUrl ? (
                                <a
                                  href={document.signedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs font-semibold text-cyan-200"
                                >
                                  View document
                                </a>
                              ) : (
                                <span className="text-xs text-red-200">
                                  Document unavailable
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-6">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                        Additional verification
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                        {displayValue(
                          evidence.additional_business_verification,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 xl:w-40">
                    <button
                      type="button"
                      onClick={() =>
                        void reviewVerification(
                          verification.id,
                          "approve",
                        )
                      }
                      disabled={busy}
                      className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Processing..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void reviewVerification(
                          verification.id,
                          "reject",
                        )
                      }
                      disabled={busy}
                      className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
