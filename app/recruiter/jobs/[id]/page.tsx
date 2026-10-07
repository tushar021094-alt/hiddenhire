import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ApplicationStatusControl from "./application-status-control";

type MatchRow = {
  id: string;
  candidate_id: string;
  score: number;
  reasons: string[] | null;
  gaps: string[] | null;
  created_at: string;
};

type ApplicationRow = {
  id: string;
  candidate_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  candidate_reminder_count: number;
  last_candidate_reminder_at: string | null;
  recruiter_response_due_at: string | null;
};

type CandidateRow = {
  candidate_id: string;
  full_name: string | null;
  headline: string | null;
  skills: string[] | null;
  experience_years: number | null;
  location: string | null;
};

export default async function RecruiterJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      `
        id,
        title,
        description,
        city,
        region,
        country,
        remote,
        workplace_type,
        salary_min,
        salary_max,
        currency,
        experience_min,
        experience_max,
        status,
        visibility,
        created_at
      `,
    )
    .eq("id", id)
    .eq("posted_by", user.id)
    .eq("source_type", "native")
    .maybeSingle();

  if (jobError || !job) {
    notFound();
  }

  const [
    { data: matchRows },
    { data: applicationRows },
    { data: candidateRows },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id, candidate_id, score, reasons, gaps, created_at")
      .eq("job_id", job.id)
      .order("score", { ascending: false }),

    supabase
      .from("applications")
      .select("id, candidate_id, status, created_at, updated_at, candidate_reminder_count, last_candidate_reminder_at, recruiter_response_due_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false }),

    supabase.rpc("recruiter_candidate_discovery_for_job", {
      p_job_id: job.id,
    }),
  ]);

  const matches: MatchRow[] = Array.isArray(matchRows) ? matchRows : [];
  const applications: ApplicationRow[] = Array.isArray(applicationRows)
    ? applicationRows
    : [];
  const candidates: CandidateRow[] = Array.isArray(candidateRows)
    ? candidateRows
    : [];

  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.candidate_id, candidate]),
  );

  const location =
    job.city || job.region
      ? [job.city, job.region, job.country].filter(Boolean).join(", ")
      : job.country;

  const salary =
    job.salary_min != null || job.salary_max != null
      ? `${job.currency || "INR"} ${
          job.salary_min?.toLocaleString("en-IN") || "—"
        } – ${job.salary_max?.toLocaleString("en-IN") || "—"}`
      : "Not specified";

  const experience =
    job.experience_min != null || job.experience_max != null
      ? `${job.experience_min ?? "—"} – ${job.experience_max ?? "—"} years`
      : "Not specified";

  return (
    <main className="app-v2 recruiter-detail-v2 min-h-screen bg-[#08090d] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-cyan-300 hover:text-cyan-200"
            >
              ← Back to dashboard
            </Link>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Job management
            </p>

            <h1 className="mt-2 text-4xl font-bold">{job.title}</h1>

            <p className="mt-2 text-sm text-white/45">
              Created {new Date(job.created_at).toLocaleString("en-IN")}
            </p>
          </div>

          <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-sm capitalize text-amber-200">
            {job.status.replace("_", " ")}
          </span>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/35">
                Location
              </p>
              <p className="mt-2 text-sm text-white/80">{location}</p>
              <p className="mt-1 text-xs text-white/40">
                {job.remote ? "Remote" : "On-site"}
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/35">
                Salary
              </p>
              <p className="mt-2 text-sm text-white/80">{salary}</p>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/35">
                Experience
              </p>
              <p className="mt-2 text-sm text-white/80">{experience}</p>
            </div>

            <div className="rounded-xl bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/35">
                Workplace
              </p>
              <p className="mt-2 text-sm text-white/80">
                {job.workplace_type}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-white/35">
              Job description
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/65">
              {job.description}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.03] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">
              AI matches
            </p>

            <p className="mt-3 text-3xl font-semibold">{matches.length}</p>

            <p className="mt-2 text-sm text-white/45">
              Candidates matched by HiddenHire&apos;s relevance-first engine.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Applications
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {applications.length}
            </p>

            <p className="mt-2 text-sm text-white/45">
              Applications received for this job.
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">
              AI candidate matches
            </p>

            <h2 className="mt-2 text-2xl font-semibold">Ranked candidates</h2>

            <p className="mt-2 text-sm text-white/45">
              Matches are persisted so they remain available after leaving
              the job creation screen.
            </p>
          </div>

          {matches.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
              No AI matches are available for this job yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {matches.map((match, index) => {
                const candidate = candidateMap.get(match.candidate_id);

                return (
                  <article
                    key={match.id}
                    className="rounded-xl border border-white/10 bg-black/10 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/35">
                            #{index + 1}
                          </span>

                          <h3 className="text-lg font-semibold">
                            {candidate?.full_name || "Candidate"}
                          </h3>
                        </div>

                        {candidate?.headline && (
                          <p className="mt-1 text-sm text-white/50">
                            {candidate.headline}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-white/35">
                          {candidate?.location || "Location not available"}
                          {candidate?.experience_years != null
                            ? ` · ${candidate.experience_years} yrs`
                            : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-bold text-cyan-300">
                          {match.score}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Match score
                        </p>
                      </div>
                    </div>

                    {match.reasons && match.reasons.length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Why this matches
                        </p>

                        <ul className="mt-2 space-y-1">
                          {match.reasons.map((reason) => (
                            <li
                              key={reason}
                              className="text-sm leading-6 text-white/65"
                            >
                              • {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {match.gaps && match.gaps.length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs uppercase tracking-wider text-white/35">
                          Gaps
                        </p>

                        <ul className="mt-2 space-y-1">
                          {match.gaps.map((gap) => (
                            <li
                              key={gap}
                              className="text-sm leading-6 text-amber-200/70"
                            >
                              • {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Applications
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Candidate applications
            </h2>

            <p className="mt-2 text-sm text-white/45">
              Applications are secured to the employer that owns this job.
            </p>
          </div>

          {applications.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
              No applications received yet.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <div className="divide-y divide-white/10">
                {applications.map((application) => {
                  const candidate = candidateMap.get(application.candidate_id);

                  return (
                    <div
                      key={application.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-medium">
                          {candidate?.full_name || "Candidate application"}
                        </h3>

                        <p className="mt-1 text-sm text-white/45">
                          Applied{" "}
                          {new Date(
                            application.created_at,
                          ).toLocaleDateString("en-IN")}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {application.recruiter_response_due_at && ["applied", "reviewing", "shortlisted"].includes(application.status) && (
                          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-medium text-amber-200">
                            ACTION REQUIRED · Candidate requested an update
                          </span>
                        )}
                        <ApplicationStatusControl
                          applicationId={application.id}
                          currentStatus={application.status}
                          responseDueAt={application.recruiter_response_due_at}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}