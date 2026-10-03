"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VerificationReviewQueue from "../verification-review-queue";

type Job = {
  id: string;
  title: string;
  description: string;
  job_function: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  remote: boolean;
  workplace_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  experience_min: number | null;
  experience_max: number | null;
  status: string;
  created_at: string;
};

export default function AdminModerationPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
      }
    }

    void checkAuth();
  }, [router]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadJobs() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/jobs/pending", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load pending jobs.");
      }

      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pending jobs."
      );
    } finally {
      setLoading(false);
    }
  }

  async function moderateJob(
    jobId: string,
    action: "publish" | "reject"
  ) {
    setActionJobId(jobId);
    setError("");
    setSuccess("");

    try {
      let reason: string | null = null;

      if (action === "reject") {
        reason = window.prompt("Enter the rejection reason:");

        if (!reason?.trim()) {
          setActionJobId(null);
          return;
        }
      }

      const response = await fetch("/api/admin/jobs/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          action,
          ...(reason ? { reason: reason.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Moderation action failed.");
      }

      setSuccess(
        action === "publish"
          ? "Job published successfully."
          : "Job rejected successfully."
      );

      await loadJobs();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Moderation action failed."
      );
    } finally {
      setActionJobId(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJobs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#05080c] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a
              href="/dashboard"
              className="text-xl font-semibold tracking-tight"
            >
              Hidden<span className="text-cyan-300">Hire</span>
            </a>

            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-300">
              Admin moderation
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Review marketplace jobs
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Review native HiddenHire jobs before they become visible to
              candidates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadJobs()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Refresh
          </button>
        </header>

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
            Loading pending jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
            <h2 className="text-xl font-semibold">
              No jobs awaiting review
            </h2>
            <p className="mt-2 text-sm text-white/50">
              The moderation queue is currently clear.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {jobs.map((job) => {
              const busy = actionJobId === job.id;

              return (
                <article
                  key={job.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-yellow-300/20 bg-yellow-300/5 px-3 py-1 text-xs text-yellow-200">
                          Pending review
                        </span>

                        {job.job_function ? (
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">
                            {job.job_function}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-4 text-2xl font-semibold">
                        {job.title}
                      </h2>

                      <p className="mt-2 text-sm text-white/50">
                        {job.city || job.region || "India"}
                        {job.remote ? " Â· Remote" : ""}
                        {job.workplace_type
                          ? ` Â· ${job.workplace_type}`
                          : ""}
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                            Salary
                          </p>
                          <p className="mt-1 text-sm text-white/75">
                            {job.salary_min != null &&
                            job.salary_max != null
                              ? `${job.salary_min.toLocaleString()} â€“ ${job.salary_max.toLocaleString()} ${job.currency ?? ""}`
                              : "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                            Experience
                          </p>
                          <p className="mt-1 text-sm text-white/75">
                            {job.experience_min != null ||
                            job.experience_max != null
                              ? `${job.experience_min ?? 0} â€“ ${job.experience_max ?? "10+"} years`
                              : "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                            Country
                          </p>
                          <p className="mt-1 text-sm text-white/75">
                            {job.country || "India"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                            Created
                          </p>
                          <p className="mt-1 text-sm text-white/75">
                            {new Date(job.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                          Job description
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">
                          {job.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-36">
                      <button
                        type="button"
                        onClick={() =>
                          void moderateJob(job.id, "publish")
                        }
                        disabled={busy}
                        className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "Processing..." : "Publish"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void moderateJob(job.id, "reject")
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
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-10 lg:px-10">
        <VerificationReviewQueue />
      </div>
    </main>
  );
}
