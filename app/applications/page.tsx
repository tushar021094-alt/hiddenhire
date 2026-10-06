"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Application = {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  updated_at: string;
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
      if (cancelled) return;
      await loadApplications();
    }

    void initialise();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-v2 min-h-screen bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </Link>
          <Link
            href="/jobs"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-cyan-300/30 hover:text-cyan-200"
          >
            Find jobs
          </Link>
        </header>

        <section className="py-12">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Candidate workspace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">My applications</h1>
          <p className="mt-4 max-w-2xl text-white/55">
            Track every HiddenHire application and see when a recruiter moves it forward.
          </p>
        </section>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-white/60">
            Loading your applications…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 text-red-200">{error}</div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
            <h2 className="text-xl font-semibold">No applications yet</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Your applications will appear here after you apply to a native HiddenHire job.
            </p>
            <Link
              href="/jobs"
              className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Explore matched jobs →
            </Link>
          </div>
        )}

        {!loading && !error && applications.length > 0 && (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-4">
              {[
                ['Total', applications.length],
                ['Active', applications.filter((a) => !['rejected', 'withdrawn', 'hired'].includes(a.status)).length],
                ['Interviews', applications.filter((a) => a.status === 'interview').length],
                ['Offers', applications.filter((a) => a.status === 'hired').length],
              ].map(([label, value]) => (
                <button key={label} type="button" onClick={() => setFilter(label === 'Total' ? 'all' : label.toString().toLowerCase())} className={`rounded-xl border p-4 text-left transition ${filter === (label === 'Total' ? 'all' : label.toString().toLowerCase()) ? 'border-cyan-300/30 bg-cyan-300/5' : 'border-white/10 bg-white/[0.025]'}`}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </button>
              ))}
            </section>
            <section className="space-y-4">
            {applications.filter((application) => {
              if (filter === 'all') return true;
              if (filter === 'active') return !['rejected', 'withdrawn', 'hired'].includes(application.status);
              if (filter === 'interviews') return application.status === 'interview';
              if (filter === 'offers') return application.status === 'hired';
              return true;
            }).map((application) => {
              const job = application.jobs;
              const location = job?.remote
                ? "Remote"
                : job?.city || job?.region || job?.location || job?.country || "Location flexible";
              const salary =
                job?.salary_min || job?.salary_max
                  ? `${job.currency || "INR"} ${job.salary_min?.toLocaleString() || "—"}–${job.salary_max?.toLocaleString() || "—"}`
                  : null;

              return (
                <article
                  key={application.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">
                        {statusLabels[application.status] || application.status}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        {job?.title || "Untitled role"}
                      </h2>
                      <p className="mt-1 text-sm text-white/55">{companyName(job?.companies)}</p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-medium text-cyan-200">
                      {statusLabels[application.status] || application.status}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/55">
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{location}</span>
                    {salary && <span className="rounded-full bg-white/5 px-2.5 py-1">{salary}</span>}
                    <span className="rounded-full bg-white/5 px-2.5 py-1">
                      Applied {formatDate(application.created_at)}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href="/jobs"
                      className="inline-flex rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/75 hover:border-cyan-300/30 hover:text-cyan-200"
                    >
                      Back to matches
                    </Link>
                    {application.status !== "withdrawn" &&
                      application.status !== "rejected" &&
                      application.status !== "hired" && (
                        <button
                          type="button"
                          onClick={() => withdraw(application.id)}
                          className="inline-flex rounded-xl border border-red-300/15 px-4 py-2.5 text-sm text-red-200/70 hover:border-red-300/30 hover:text-red-100"
                        >
                          Withdraw
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
