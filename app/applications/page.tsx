"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Application = {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  candidate_reminder_count?: number;
  last_candidate_reminder_at?: string | null;
  recruiter_response_due_at?: string | null;
  recruiter_quality?: {
    total_applications: number;
    response_rate: number;
    overdue_applications: number;
    median_first_response_hours: number | null;
    responsiveness_score: number;
    trust_tier: "new" | "highly_responsive" | "responsive" | "needs_attention";
    repeated_non_response: boolean;
    identity_verified: boolean;
    company_verified: boolean;
    trust_score: number;
  } | null;
  jobs?: {
    id: string;
    title: string | null;
    company_id: string | null;
    location: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    remote: boolean | null;
    salary_min: number | null;
    salary_max: number | null;
    currency: string | null;
    source_type: string | null;
    posted_by?: string | null;
    companies?: { name: string | null } | { name: string | null }[] | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  applied: "Applied",
  reviewing: "Under review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const statusTone: Record<string, string> = {
  applied: "is-blue",
  reviewing: "is-indigo",
  shortlisted: "is-violet",
  interview: "is-amber",
  hired: "is-green",
  rejected: "is-red",
  withdrawn: "is-gray",
};

type Company = { name: string | null } | { name: string | null }[] | null | undefined;

function companyName(company: Company) {
  if (Array.isArray(company)) return company[0]?.name || "Company undisclosed";
  return company?.name || "Company undisclosed";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function isActive(status: string) {
  return !["rejected", "withdrawn", "hired"].includes(status);
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadApplications() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/applications");
      const payload = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load applications.");
      }

      setApplications(Array.isArray(payload?.applications) ? payload.applications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }

  async function remindRecruiter(applicationId: string) {
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action: "remind" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to send reminder.");
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                candidate_reminder_count: payload?.reminder?.candidate_reminder_count ?? application.candidate_reminder_count,
                last_candidate_reminder_at: payload?.reminder?.last_candidate_reminder_at ?? application.last_candidate_reminder_at,
                recruiter_response_due_at: payload?.reminder?.recruiter_response_due_at ?? application.recruiter_response_due_at,
              }
            : application,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reminder.");
    }
  }

  async function withdraw(applicationId: string) {
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status: "withdrawn" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to withdraw application.");
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId ? { ...application, status: "withdrawn" } : application,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to withdraw application.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialise() {
      if (!cancelled) await loadApplications();
    }
    void initialise();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      total: applications.length,
      active: applications.filter((a) => isActive(a.status)).length,
      interviews: applications.filter((a) => a.status === "interview").length,
      offers: applications.filter((a) => a.status === "hired").length,
    }),
    [applications],
  );

  const filtered = applications.filter((application) => {
    if (filter === "active") return isActive(application.status);
    if (filter === "interviews") return application.status === "interview";
    if (filter === "offers") return application.status === "hired";
    return true;
  });

  return (
    <main className="app-v2 applications-v2 min-h-screen text-slate-900">
      <div className="workspace-shell">
        <header className="workspace-header">
          <div className="workspace-brand-row">
            <Link href="/dashboard" className="workspace-brand">
              Hidden<span>Hire</span>
            </Link>
            <nav className="workspace-nav" aria-label="Candidate navigation">
              <Link href="/dashboard">Overview</Link>
              <Link href="/jobs">Discover</Link>
              <Link href="/applications" className="is-active">Applications</Link>
              <Link href="/profile">Profile</Link>
            </nav>
          </div>
          <Link href="/jobs" className="workspace-header-action">Find jobs <span>↗</span></Link>
        </header>

        <section className="workspace-hero applications-hero">
          <div>
            <span className="workspace-eyebrow">Candidate workspace</span>
            <h1>Applications, without the spreadsheet.</h1>
            <p>Keep your pipeline visible, understand where each opportunity stands, and move quickly when a recruiter responds.</p>
          </div>
          <div className="hero-action-card">
            <span>Next best move</span>
            <strong>{counts.active ? "Review your active pipeline" : "Find your next strong match"}</strong>
            <Link href={counts.active ? "/applications" : "/jobs"}>{counts.active ? "Open pipeline →" : "Explore matches →"}</Link>
          </div>
        </section>

        {loading && <div className="workspace-state">Loading your application pipeline…</div>}

        {!loading && error && (
          <div className="workspace-state workspace-state-error">{error}</div>
        )}

        {!loading && !error && (
          <>
            <section className="application-metrics" aria-label="Application summary">
              {[
                ["all", "Total applications", counts.total, "Everything you have submitted"],
                ["active", "Active", counts.active, "Still moving through a process"],
                ["interviews", "Interviews", counts.interviews, "Roles that reached interview"],
                ["offers", "Offers", counts.offers, "Successful outcomes"],
              ].map(([key, label, value, hint]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(String(key))}
                  className={`application-metric ${filter === key ? "is-selected" : ""}`}
                >
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{hint}</small>
                </button>
              ))}
            </section>

            {applications.length === 0 ? (
              <section className="application-empty">
                <div className="empty-orb">↗</div>
                <div>
                  <span className="workspace-eyebrow">Pipeline is empty</span>
                  <h2>Your next opportunity starts with a strong match.</h2>
                  <p>Your applications will appear here after you apply to a native HiddenHire job.</p>
                  <Link href="/jobs" className="workspace-primary-button">Explore matched jobs →</Link>
                </div>
              </section>
            ) : filtered.length === 0 ? (
              <section className="workspace-state">
                No applications match this view. Choose another pipeline filter above.
              </section>
            ) : (
              <section className="application-list" aria-label="Applications">
                {filtered.map((application) => {
                  const job = application.jobs;
                  const location = job?.remote
                    ? "Remote"
                    : job?.city || job?.region || job?.location || job?.country || "Location flexible";
                  const salary =
                    job?.salary_min || job?.salary_max
                      ? `${job.currency || "INR"} ${job.salary_min?.toLocaleString() || "—"}–${job.salary_max?.toLocaleString() || "—"}`
                      : null;
                  const tone = statusTone[application.status] || "is-gray";

                  return (
                    <article key={application.id} className="application-card">
                      <div className="application-card-main">
                        <div className="application-card-title">
                          <div className={`application-status ${tone}`}>
                            <span />
                            {statusLabels[application.status] || application.status}
                          </div>
                          <h2>{job?.title || "Untitled role"}</h2>
                          <p>{companyName(job?.companies)}</p>
                        </div>

                        {application.recruiter_quality && application.recruiter_quality.total_applications >= 5 && application.recruiter_quality.trust_tier === "trusted" && (
                          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-1 text-xs text-emerald-200">
                            <span>✓</span> Trusted recruiter · identity and company verified
                          </div>
                        )}
                        <div className="application-meta">
                          <span>{location}</span>
                          {salary && <span>{salary}</span>}
                          <span>Applied {formatDate(application.created_at)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                          {isActive(application.status) &&
                            application.status === "applied" &&
                            application.jobs?.source_type === "native" &&
                            Date.now() - new Date(application.created_at).getTime() >= 5 * 86_400_000 && (
                              application.last_candidate_reminder_at &&
                            Date.now() - new Date(application.last_candidate_reminder_at).getTime() < 3 * 86_400_000 ? (
                              <span className="rounded-full border border-amber-300/20 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                                Reminder sent · awaiting response
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => remindRecruiter(application.id)}
                                className="workspace-secondary-button"
                              >
                                {application.candidate_reminder_count ? "Remind again" : "Remind recruiter"}
                              </button>
                            )
                            )}
                          {application.recruiter_response_due_at && (
                            <span className="text-xs text-slate-500">
                              Requested by {formatDate(application.recruiter_response_due_at)}
                            </span>
                          )}
                        </div>

                        <div className="application-card-side">
                        <span className={`application-status-pill ${tone}`}>
                          {statusLabels[application.status] || application.status}
                        </span>
                        <div className="application-actions">
                          <Link href="/jobs" className="workspace-secondary-button">View matches</Link>
                          {isActive(application.status) && (
                            <button
                              type="button"
                              onClick={() => withdraw(application.id)}
                              className="workspace-danger-button"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
