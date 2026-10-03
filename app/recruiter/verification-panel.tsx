"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VerificationState = {
  verified: boolean;
  status: "not_submitted" | "pending" | "verified" | "rejected";
};

type OrganisationType =
  | "private_limited"
  | "public_limited"
  | "llp"
  | "partnership"
  | "proprietorship"
  | "recruitment_agency"
  | "international"
  | "";

type DocumentItem = {
  type: string;
  path: string;
  file_name: string;
  mime_type: string;
  size: number;
};

type FormState = {
  mobile: string;
  recruiter_name: string;
  designation: string;

  organisation_type: OrganisationType;

  company_name: string;
  company_website: string;
  company_domain: string;

  legal_company_name: string;
  cin: string;
  llpin: string;
  company_pan: string;
  registered_address: string;

  gst_registered: string;
  gstin: string;

  proprietor_name: string;
  business_trade_name: string;
  udyam_number: string;

  business_registration_details: string;
  additional_business_verification: string;
};

const initialForm: FormState = {
  mobile: "",
  recruiter_name: "",
  designation: "",

  organisation_type: "",

  company_name: "",
  company_website: "",
  company_domain: "",

  legal_company_name: "",
  cin: "",
  llpin: "",
  company_pan: "",
  registered_address: "",

  gst_registered: "",
  gstin: "",

  proprietor_name: "",
  business_trade_name: "",
  udyam_number: "",

  business_registration_details: "",
  additional_business_verification: "",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function VerificationPanel() {
  const [state, setState] = useState<VerificationState | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadStatus() {
    const supabase = createClient();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/recruiter/verification", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load verification status."
        );
      }

      setState({
        verified: data.verified === true,
        status: data.status ?? "not_submitted",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load verification status."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateField(key: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleDocumentUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const supabase = createClient();
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        "Only PDF, JPG, PNG, and WEBP documents are allowed."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Each verification document must be 10 MB or smaller.");
      return;
    }

    setUploading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          userError?.message || "Authentication is required."
        );
      }

      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(-120);

      const path =
        `recruiter-verification/${user.id}/` +
        `${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setDocuments((current) => [
        ...current,
        {
          type: "business_verification",
          path,
          file_name: file.name,
          mime_type: file.type,
          size: file.size,
        },
      ]);

      setSuccess("Verification document uploaded securely.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload verification document."
      );
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(document: DocumentItem) {
    const supabase = createClient();
    setError("");
    setSuccess("");

    try {
      const { error: removeError } = await supabase.storage
        .from("verification-documents")
        .remove([document.path]);

      if (removeError) {
        throw new Error(removeError.message);
      }

      setDocuments((current) =>
        current.filter((item) => item.path !== document.path)
      );

      setSuccess("Document removed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove document."
      );
    }
  }

  async function submitVerification(event: React.FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/recruiter/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          evidence: {
            ...form,
            verification_documents: documents,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Verification request failed."
        );
      }

      setSuccess(
        "Verification request submitted. An admin will review your details."
      );

      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification request failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.03] p-6">
        <p className="text-sm text-white/50">
          Loading verification status...
        </p>
      </section>
    );
  }

  if (state?.verified || state?.status === "verified") {
    return (
      <section className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.03] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-emerald-300/70">
              Recruiter verification
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Verified recruiter
            </h2>

            <p className="mt-2 text-sm text-white/50">
              Your account is verified and can post jobs.
            </p>
          </div>

          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs text-emerald-200">
            Verified
          </span>
        </div>
      </section>
    );
  }

  const pending = state?.status === "pending";

  return (
    <section className="mb-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.03] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-cyan-300/70">
            Recruiter verification
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            {pending
              ? "Verification under review"
              : "Verify your recruiter account"}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Verification is required before you can post a native HiddenHire
            job.
          </p>
        </div>

        <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-xs text-amber-200">
          {pending ? "Pending review" : "Not verified"}
        </span>
      </div>

      {pending ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          Your verification request has been submitted and is waiting for
          admin review.
        </div>
      ) : (
        <form
          onSubmit={submitVerification}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <label className="text-xs uppercase tracking-wider text-white/40">
            Mobile number
            <input
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.mobile}
              onChange={(e) => updateField("mobile", e.target.value)}
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Recruiter name
            <input
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.recruiter_name}
              onChange={(e) =>
                updateField("recruiter_name", e.target.value)
              }
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Designation
            <input
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.designation}
              onChange={(e) =>
                updateField("designation", e.target.value)
              }
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Organisation type
            <select
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.organisation_type}
              onChange={(e) =>
                updateField(
                  "organisation_type",
                  e.target.value
                )
              }
            >
              <option value="">Select organisation type</option>
              <option value="private_limited">
                Private Limited Company
              </option>
              <option value="public_limited">
                Public Limited Company
              </option>
              <option value="llp">LLP</option>
              <option value="partnership">Partnership</option>
              <option value="proprietorship">Proprietorship</option>
              <option value="recruitment_agency">
                Recruitment / Staffing Agency
              </option>
              <option value="international">
                International Company
              </option>
            </select>
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Company / agency name
            <input
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.company_name}
              onChange={(e) =>
                updateField("company_name", e.target.value)
              }
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Legal company name
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.legal_company_name}
              onChange={(e) =>
                updateField("legal_company_name", e.target.value)
              }
            />
          </label>

          {(form.organisation_type === "private_limited" ||
            form.organisation_type === "public_limited") && (
            <label className="text-xs uppercase tracking-wider text-white/40">
              CIN
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                value={form.cin}
                onChange={(e) =>
                  updateField("cin", e.target.value)
                }
                placeholder="Company Identification Number"
              />
            </label>
          )}

          {form.organisation_type === "llp" && (
            <label className="text-xs uppercase tracking-wider text-white/40">
              LLPIN
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                value={form.llpin}
                onChange={(e) =>
                  updateField("llpin", e.target.value)
                }
              />
            </label>
          )}

          {form.organisation_type === "proprietorship" && (
            <>
              <label className="text-xs uppercase tracking-wider text-white/40">
                Business / trade name
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  value={form.business_trade_name}
                  onChange={(e) =>
                    updateField(
                      "business_trade_name",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="text-xs uppercase tracking-wider text-white/40">
                Proprietor name
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  value={form.proprietor_name}
                  onChange={(e) =>
                    updateField(
                      "proprietor_name",
                      e.target.value
                    )
                  }
                />
              </label>

              <label className="text-xs uppercase tracking-wider text-white/40">
                Udyam number
                <input
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  value={form.udyam_number}
                  onChange={(e) =>
                    updateField("udyam_number", e.target.value)
                  }
                />
              </label>
            </>
          )}

          <label className="text-xs uppercase tracking-wider text-white/40">
            Company PAN
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white uppercase outline-none"
              value={form.company_pan}
              onChange={(e) =>
                updateField(
                  "company_pan",
                  e.target.value.toUpperCase()
                )
              }
              placeholder="PAN"
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            GST registered
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.gst_registered}
              onChange={(e) =>
                updateField("gst_registered", e.target.value)
              }
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          {form.gst_registered === "yes" && (
            <label className="text-xs uppercase tracking-wider text-white/40">
              GSTIN
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white uppercase outline-none"
                value={form.gstin}
                onChange={(e) =>
                  updateField(
                    "gstin",
                    e.target.value.toUpperCase()
                  )
                }
              />
            </label>
          )}

          <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">
            Registered address
            <textarea
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.registered_address}
              onChange={(e) =>
                updateField(
                  "registered_address",
                  e.target.value
                )
              }
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Company website
            <input
              type="url"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.company_website}
              onChange={(e) =>
                updateField("company_website", e.target.value)
              }
              placeholder="Optional"
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40">
            Company email domain
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.company_domain}
              onChange={(e) =>
                updateField("company_domain", e.target.value)
              }
              placeholder="Optional"
            />
          </label>

          <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">
            Business registration details
            <textarea
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.business_registration_details}
              onChange={(e) =>
                updateField(
                  "business_registration_details",
                  e.target.value
                )
              }
              placeholder="Registration details relevant to your organisation type."
            />
          </label>

          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[.18em] text-cyan-300/70">
                  Business documents
                </p>

                <h3 className="mt-2 text-base font-semibold text-white">
                  Upload supporting verification documents
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/50">
                  Private storage. PDF, JPG, PNG, and WEBP. Maximum 10 MB per
                  document.
                </p>
              </div>

              <label className="cursor-pointer rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-2 text-xs font-semibold text-cyan-200">
                {uploading ? "Uploading..." : "Add document"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleDocumentUpload}
                />
              </label>
            </div>

            {documents.length > 0 ? (
              <div className="mt-4 space-y-2">
                {documents.map((document) => (
                  <div
                    key={document.path}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {document.file_name}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {(document.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeDocument(document)}
                      className="shrink-0 text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/40">
                No verification documents uploaded yet.
              </div>
            )}
          </div>

          <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">
            Additional business verification
            <textarea
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              value={form.additional_business_verification}
              onChange={(e) =>
                updateField(
                  "additional_business_verification",
                  e.target.value
                )
              }
              placeholder="Optional additional supporting information."
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200 md:col-span-2">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200 md:col-span-2">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          >
            {submitting
              ? "Submitting verification..."
              : "Submit verification request"}
          </button>
        </form>
      )}
    </section>
  );
}