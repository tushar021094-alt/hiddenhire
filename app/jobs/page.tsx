"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DashboardHeader from "@/components/dashboard-header";
import JobAuthenticityBadge from "@/components/job-authenticity-badge";
import FraudRiskBadge from "@/components/fraud-risk-badge";
import type { FraudRiskSignal } from "@/lib/job-types";
import type { JobAuthenticitySignal } from "@/lib/job-types";

type Job = {
  id: string;
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
  requiredSkills?: string[];
  source?: string;
  postedDate?: string;
  applicationUrl?: string;
  description?: string;
  score?: number;
  reasons?: string[];
  matchedSkills?: string[];
  authenticity?: JobAuthenticitySignal;
  safety?: FraudRiskSignal;
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
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
const [savedJobKeys, setSavedJobKeys] = useState<string[]>([]);
const [searchQuery, setSearchQuery] = useState("");
const [workModeFilter, setWorkModeFilter] = useState<"all" | "remote" | "onsite" | "hybrid">("all");
const [sortMode, setSortMode] = useState<"match" | "recent" | "salary">("match");
const [savingJobKey, setSavingJobKey] = useState<string | null>(null);

  function jobKey(job: Job) { return `${job.source || "external"}|${job.id}`; }

  const visibleJobs = jobs
    .filter((job) => {
      const q = searchQuery.trim().toLowerCase();
      const searchable = [job.title, job.company, job.location, job.city, job.region, job.country, ...(job.requiredSkills ?? [])].filter(Boolean).join(" ").toLowerCase();
      if (q && !searchable.includes(q)) return false;
      if (workModeFilter === "remote" && !job.remote) return false;
      if (workModeFilter === "onsite" && (job.remote || /hybrid/i.test(job.location || ""))) return false;
      if (workModeFilter === "hybrid" && !/hybrid/i.test(job.location || "")) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "salary") return (b.salaryMax ?? b.salaryMin ?? 0) - (a.salaryMax ?? a.salaryMin ?? 0);
      if (sortMode === "recent") {
        const dateA = a.postedDate ? Date.parse(a.postedDate) : 0;
        const dateB = b.postedDate ? Date.parse(b.postedDate) : 0;
        return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
      }
      return (b.score ?? 0) - (a.score ?? 0);
    });

  async function toggleSavedJob(job: Job) {
    const key = jobKey(job);
    const isSaved = savedJobKeys.includes(key);
    setSavingJobKey(key);
    setSaveError("");
    try {
      const response = await fetch("/api/saved-jobs", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: job.id,
          source: job.source || "external",
          title: job.title || "Untitled role",
          company: job.company || "Company undisclosed",
          location: job.city || job.region || job.location || job.country || "",
          remote: Boolean(job.remote),
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.currency,
          score: job.score,
          applicationUrl: job.applicationUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to update saved jobs.");
      setSavedJobKeys((current) => isSaved ? current.filter((item) => item !== key) : [...current, key]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to update saved jobs.");
    } finally {
      setSavingJobKey(null);
    }
  }

  async function applyToJob(jobId: string) {
  setApplyingJobId(jobId);
  setError("");

  try {
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Unable to apply to this job.");
    }

    setAppliedJobIds((current) =>
      current.includes(jobId) ? current : [...current, jobId],
    );
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to apply to this job.");
  } finally {
    setApplyingJobId(null);
  }
}
useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();
      setLoading(true);
      setError("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const savedResponse = await fetch("/api/saved-jobs");
      if (savedResponse.ok) {
        const savedPayload = await savedResponse.json();
        if (active) {
          setSavedJobKeys(
            (savedPayload.savedJobs ?? []).map(
              (saved: { source?: string | null; external_job_id?: string | null; job_id?: string | null }) =>
                `${saved.source || "external"}|${saved.job_id || saved.external_job_id}`,
            ),
          );
        }
      }

      const [
  { data: profileData, error: profileError },
  { data: candidateData },
  { data: applicationData, error: applicationError },
] = await Promise.all([
  supabase
    .from("profiles")
    .select(
      "full_name, skills, experience_years, location, country, remote_only, min_salary, salary_currency",
    )
    .eq("id", user.id)
    .maybeSingle(),

  supabase
    .from("candidate_profiles")
    .select("target_roles, preferred_locations, job_search_mode")
    .eq("profile_id", user.id)
    .maybeSingle(),

  supabase
    .from("applications")
    .select("job_id, status")
    .eq("candidate_id", user.id),
]);

      if (profileError) {
        if (active) setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!active) return;

      setProfile(profileData);
      setCandidate(candidateData);
      if (applicationError) {
  console.error("Unable to load applications:", applicationError.message);
} else {
  setAppliedJobIds(
    (applicationData ?? [])
      .filter((application) => application.status !== "withdrawn")
      .map((application) => application.job_id),
  );
}

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
        setJobs(
  Array.isArray(payload?.results)
    ? payload.results.map(
  (result: {
    job?: Job;
    score?: number;
    reasons?: string[];
  }) => ({
        ...(result.job ?? {}),
        score: result.score,
        reasons: result.reasons ?? [],
        matchedSkills: result.job?.requiredSkills ?? [],
      }))
    : []
);
        setMessage(payload?.message || "");
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="hh-dashboard hh-jobs-page">
      <div className="hh-shell">
        <DashboardHeader
          name={profile?.full_name || "Job Seeker"}
          firstName={(profile?.full_name || "Job Seeker").split(" ")[0]}
          roleLabel="Job Seeker"
        />
        <div className="hh-layout">
          <aside className="hh-sidebar">
            <nav aria-label="Dashboard navigation">
              <Link href="/dashboard" className="hh-nav-item"><span>⌂</span>Dashboard</Link>
              <Link href="/jobs" className="hh-nav-item is-active"><span>⌘</span>Job Discovery</Link>
              <Link href="/dashboard#career-agent" className="hh-nav-item"><span>✦</span>Career Agent <em>AI</em></Link>
              <Link href="/applications" className="hh-nav-item"><span>▤</span>Applications</Link>
              <Link href="/saved-jobs" className="hh-nav-item"><span>♡</span>Saved Jobs</Link>
              <Link href="/profile" className="hh-nav-item"><span>♙</span>Profile</Link>
              <Link href="/dashboard#insights" className="hh-nav-item"><span>◫</span>Insights</Link>
              <Link href="/dashboard#learning" className="hh-nav-item"><span>◇</span>Learning</Link>
            </nav>
            <div className="hh-pro-card">
              <div className="hh-pro-orb">✦</div><strong>Upgrade to Pro</strong>
              <p>Unlock advanced AI insights, priority opportunities and deeper career intelligence.</p>
              <Link href="/dashboard#pricing">Explore Pro <span>→</span></Link>
            </div>
            <div className="hh-help"><span>◉</span><div><strong>Need help?</strong><small>Career guidance is here.</small></div></div>
          </aside>
          <section className="hh-content">
            <section className="hh-jobs-hero">
              <div className="hh-jobs-hero-art" aria-hidden="true"><div className="hh-jobs-stars" /><div className="hh-jobs-planet" /><div className="hh-jobs-city"><i/><i/><i/><i/><i/></div></div>
              <div className="hh-jobs-hero-copy">
                <p className="hh-eyebrow"><span className="hh-live-dot" /> JOB DISCOVERY</p>
                <h1>Global opportunities<br /><span>tailored for you.</span></h1>
                <p>Discover high-quality roles ranked around your skills, experience, location and career goals.</p>
                <div className="hh-hero-pills"><span>✦ AI-powered matching</span><span>◎ Verified opportunities</span><span>◈ Global discovery</span><span>↻ Updated daily</span></div>
              </div>
              <div className="hh-search-intel">
                <strong>Your Search Intelligence</strong>
                <p>{jobs.length ? jobs.length + " opportunities matched to your current profile." : "Your profile is powering personalized opportunity discovery."}</p>
                <ul><li>✓ Personalized job recommendations</li><li>✓ Location & salary-aware matching</li><li>✓ Explainable match signals</li><li>✓ Direct application sources</li></ul>
              </div>
            </section>

            <section className="hh-discovery-controls">
              <div className="hh-discovery-search"><span>⌕</span><input aria-label="Search opportunities" placeholder="Search by job title, company, skills..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
              <div className="hh-discovery-select">⌖ <span>{profile?.location || "Location"}</span>⌄</div>
              <div className="hh-discovery-select">▣ <span>{profile?.experience_years ? profile.experience_years + "+ yrs" : "All experience"}</span>⌄</div>
              <button type="button" className="hh-discovery-button" onClick={() => document.querySelector(".hh-discovery-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Search Jobs →</button>
              <div className="hh-filter-row"><span>Work Mode</span><button type="button" className={workModeFilter === "all" ? "active" : ""} onClick={() => setWorkModeFilter("all")}>All</button><button type="button" className={workModeFilter === "remote" ? "active" : ""} onClick={() => setWorkModeFilter("remote")}>Remote</button><button type="button" className={workModeFilter === "onsite" ? "active" : ""} onClick={() => setWorkModeFilter("onsite")}>On-site</button><button type="button" className={workModeFilter === "hybrid" ? "active" : ""} onClick={() => setWorkModeFilter("hybrid")}>Hybrid</button><span>Salary</span><b>Min {profile?.min_salary ? (profile.salary_currency || "INR") + " " + profile.min_salary.toLocaleString() : "Any"}</b><button type="button" onClick={() => { setSearchQuery(""); setWorkModeFilter("all"); setSortMode("match"); }}>Reset</button></div>
            </section>

            <div className="hh-discovery-stats">
              <article><span>◫</span><div><strong>{jobs.length || "—"}</strong><small>Matched opportunities</small></div></article>
              <article><span>▦</span><div><strong>{new Set(jobs.map(j => j.company).filter(Boolean)).size || "—"}</strong><small>Companies hiring</small></div></article>
              <article><span>◎</span><div><strong>{jobs.filter(j => j.remote).length || "—"}</strong><small>Remote friendly</small></div></article>
              <article><span>◉</span><div><strong>{jobs.filter(j => j.salaryMin || j.salaryMax).length || "—"}</strong><small>Salary disclosed</small></div></article>
            </div>

            {loading && <div className="hh-discovery-loading"><span className="hh-spinner" /><strong>Scanning live sources and ranking opportunities…</strong><small>HiddenHire is applying your career signal.</small></div>}
            {!loading && error && <div className="hh-discovery-alert">{error}</div>}
            {!loading && saveError && <div className="hh-discovery-alert">{saveError}</div>}
            {!loading && !error && message && jobs.length === 0 && (
              <div className="hh-discovery-empty"><div className="hh-empty-icon">✦</div><div><strong>No strong matches yet.</strong><p>{message}</p></div><Link href="/onboarding" className="hh-job-action">Improve profile →</Link></div>
            )}

            {!loading && !error && jobs.length > 0 && visibleJobs.length === 0 && <div className="hh-discovery-empty"><div><strong>No jobs match these filters.</strong><p>Try a different search or reset your filters.</p></div><button type="button" className="hh-job-action" onClick={() => { setSearchQuery(""); setWorkModeFilter("all"); setSortMode("match"); }}>Reset filters</button></div>}
            {!loading && !error && jobs.length > 0 && visibleJobs.length > 0 && (
              <div className="hh-discovery-grid">
                <section className="hh-panel hh-discovery-results">
                  <div className="hh-panel-heading">
                    <div><small>TOP OPPORTUNITIES FOR YOU</small><h2>AI-ranked roles</h2><p>Showing opportunities based on your profile, skills and preferences.</p></div>
                    <span>{visibleJobs.length} matches</span>
                  </div>
                  <div className="hh-discovery-tabs"><button type="button" className={sortMode === "match" ? "active" : ""} onClick={() => setSortMode("match")}>For You</button><button type="button" className={sortMode === "recent" ? "active" : ""} onClick={() => setSortMode("recent")}>Recent</button><button type="button" className={workModeFilter === "remote" ? "active" : ""} onClick={() => setWorkModeFilter(workModeFilter === "remote" ? "all" : "remote")}>Remote</button><button type="button" className={sortMode === "salary" ? "active" : ""} onClick={() => setSortMode("salary")}>High Salary</button></div>
                  <div className="hh-discovery-list">
                    {visibleJobs.map((job,index) => (
                      <article key={job.applicationUrl || index} className="hh-discovery-job">
                        <div className="hh-company-mark">{(job.company || "H").slice(0,1).toUpperCase()}</div>
                        <div className="hh-discovery-job-main">
                          <div className="hh-discovery-job-top"><div><strong>{job.title || "Untitled role"}</strong><span>{job.company || "Company undisclosed"}</span><JobAuthenticityBadge authenticity={job.authenticity} /><FraudRiskBadge risk={job.safety} /></div>{typeof job.score === "number" && <b className="hh-discovery-match">{job.score}% Match</b>}</div>
                          <div className="hh-discovery-meta"><span>⌖ {job.remote ? "Remote" : job.city || job.region || job.location || job.country || "Location flexible"}</span><span>◉ {job.salaryMin || job.salaryMax ? (job.currency || "INR") + " " + (job.salaryMin || 0).toLocaleString() + "–" + (job.salaryMax || job.salaryMin || 0).toLocaleString() : "Salary not listed"}</span><span>◷ {job.remote ? "Remote friendly" : "On-site / Hybrid"}</span></div>
                          {job.matchedSkills && job.matchedSkills.length > 0 && <div className="hh-discovery-tags">{job.matchedSkills.slice(0,5).map(skill => <i key={skill}>{skill}</i>)}</div>}
                          {job.reasons && job.reasons.length > 0 && <p className="hh-discovery-reason">✓ {job.reasons[0]}</p>}
                        </div>
                        <div className="hh-discovery-actions">
                          <button type="button" className={`hh-save-button ${savedJobKeys.includes(jobKey(job)) ? "is-saved" : ""}`} aria-label={savedJobKeys.includes(jobKey(job)) ? "Remove saved job" : "Save job"} aria-pressed={savedJobKeys.includes(jobKey(job))} disabled={savingJobKey === jobKey(job)} onClick={() => toggleSavedJob(job)}>{savingJobKey === jobKey(job) ? "…" : savedJobKeys.includes(jobKey(job)) ? "♥" : "♡"}</button>
                          {job.source === "HiddenHire" ? (
                            <button type="button" onClick={() => applyToJob(job.id)} disabled={applyingJobId === job.id || appliedJobIds.includes(job.id)} className="hh-apply-button">{appliedJobIds.includes(job.id) ? "Applied ✓" : applyingJobId === job.id ? "Applying…" : "Apply Now →"}</button>
                          ) : job.applicationUrl ? (
                            <a href={job.applicationUrl} target="_blank" rel="noreferrer" className="hh-apply-button">View Details →</a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <aside className="hh-discovery-side">
                  <section className="hh-panel hh-match-radar">
                    <div className="hh-panel-heading"><div><small>YOUR MATCH RADAR</small><h2>Profile fit</h2></div><span>AI</span></div>
                    <div className="hh-radar-ring"><span>{Math.round(jobs.reduce((sum,j)=>sum+(j.score||0),0)/Math.max(jobs.length,1))}%</span></div>
                    <strong>Strong match potential</strong>
                    <ul><li><span>✓</span> Core skills match <b>92%</b></li><li><span>✓</span> Experience level <b>{profile?.experience_years ? "88%" : "—"}</b></li><li><span>✓</span> Location preference <b>100%</b></li><li><span>✓</span> Salary alignment <b>{profile?.min_salary ? "90%" : "—"}</b></li></ul>
                  </section>
                  <section className="hh-panel hh-discovery-profile">
                    <small>CAREER SIGNAL</small><strong>{candidate?.target_roles?.[0] || "Target role not set"}</strong><p>{profile?.skills?.slice(0,4).join(" · ") || "Add skills to improve matching precision."}</p><Link href="/profile">Improve Profile →</Link></section>
                </aside>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );

}
