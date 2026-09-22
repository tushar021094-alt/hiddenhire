"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Job = {
  title?: string;
  company?: string;
  location?: string;
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  applicationUrl?: string;
  description?: string;
  score?: number;
  reasons?: string[];
  matchedSkills?: string[];
};

type Profile = {
  full_name: string | null;
  skills: string[] | null;
  experience_years: number | null;
  location: string | null;
  country: string | null;
  remote_only: boolean | null;
  min_salary: number | null;
  salary_currency: string | null;
};

type CandidateProfile = {
  target_roles: string[] | null;
  preferred_locations: string[] | null;
  job_search_mode: string | null;
};

export default function JobsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const [{ data: profileData, error: profileError }, { data: candidateData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, skills, experience_years, location, country, remote_only, min_salary, salary_currency")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("candidate_profiles")
          .select("target_roles, preferred_locations, job_search_mode")
          .eq("profile_id", user.id)
          .maybeSingle(),
      ]);

      if (profileError) {
        if (active) setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!active) return;

      setProfile(profileData);
      setCandidate(candidateData);

      const targetRoles = candidateData?.target_roles ?? [];
      const preferredLocations = candidateData?.preferred_locations ?? [];

      if (!targetRoles.length) {
        setMessage("Complete your candidate profile to activate Match Radar.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: targetRoles[0],
          targetRoles,
          targetJobTitle: targetRoles[0],
          yearsOfExperience: profileData?.experience_years ?? 0,
          minimumSalary: profileData?.min_salary ?? 0,
          remoteOnly: Boolean(profileData?.remote_only),
          preferredCountries: [profileData?.country || "India"],
          preferredLocations,
          country: profileData?.country || "India",
          skills: profileData?.skills ?? [],
          jobSearchMode: candidateData?.job_search_mode ?? "active",
        }),
      });

      const payload = await response.json();

      if (!active) return;

      if (!response.ok) {
        setError(payload?.message || "Unable to load matched jobs.");
      } else {
        setJobs(Array.isArray(payload?.results) ? payload.results : []);
        setMessage(payload?.message || "");
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#05080c] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </Link>
          <Link href="/onboarding" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-cyan-300/30 hover:text-cyan-200">
            Edit profile
          </Link>
        </header>

        <section className="py-12">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Candidate intelligence</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Your Match Radar</h1>
          <p className="mt-4 max-w-3xl text-white/55">
            HiddenHire ranks opportunities using your target function, skills, experience, location, remote preference and compensation floor.
          </p>
        </section>

        {profile && (
          <section className="mb-6 flex flex-wrap gap-2">
            {(candidate?.target_roles ?? []).map((role) => (
              <span key={role} className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">{role}</span>
            ))}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
              {profile.experience_years ?? 0} yrs experience
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
              {profile.remote_only ? "Remote only" : profile.location || "Location flexible"}
            </span>
          </section>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-white/60">
            AI is searching and ranking live opportunities…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 text-red-200">{error}</div>
        )}

        {!loading && !error && message && jobs.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8">
            <h2 className="text-xl font-semibold">No strong matches yet</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">{message}</p>
            <Link href="/onboarding" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
              Improve your profile
            </Link>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <section className="grid gap-4 lg:grid-cols-2">
            {jobs.map((job, index) => (
              <article key={job.applicationUrl || index} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">AI match</p>
                    <h2 className="mt-2 text-xl font-semibold">{job.title || "Untitled role"}</h2>
                    <p className="mt-1 text-sm text-white/55">{job.company || "Company undisclosed"}</p>
                  </div>
                  {typeof job.score === "number" && (
                    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-center">
                      <div className="text-xl font-semibold text-cyan-200">{job.score}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/40">fit</div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/55">
                  {(job.remote ? ["Remote"] : [job.city || job.region || job.location || job.country || "Location not specified"]).map((item) => (
                    <span key={item} className="rounded-full bg-white/5 px-2.5 py-1">{item}</span>
                  ))}
                  {(job.salaryMin || job.salaryMax) && (
                    <span className="rounded-full bg-white/5 px-2.5 py-1">
                      {job.currency || "INR"} {job.salaryMin?.toLocaleString() || "—"}–{job.salaryMax?.toLocaleString() || "—"}
                    </span>
                  )}
                </div>

                {job.matchedSkills && job.matchedSkills.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/35">Matched signals</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {job.matchedSkills.slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-full border border-cyan-300/15 px-2.5 py-1 text-xs text-cyan-100/70">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {job.reasons && job.reasons.length > 0 && (
                  <ul className="mt-5 space-y-2 text-sm text-white/55">
                    {job.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
                  </ul>
                )}

                {job.applicationUrl && (
                  <a href={job.applicationUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
                    View opportunity →
                  </a>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
