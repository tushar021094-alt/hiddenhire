"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DashboardHeader from "@/components/dashboard-header";

type SavedJob = {
  id: string;
  external_job_id: string | null;
  job_id: string | null;
  source: string | null;
  job_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  score: number | null;
  created_at: string;
};

export default function SavedJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [name, setName] = useState("Job Seeker");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadSavedJobs() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/saved-jobs");
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(payload?.error || "Unable to load saved jobs.");
      setJobs(Array.isArray(payload.savedJobs) ? payload.savedJobs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (active && data?.full_name) setName(data.full_name);
      if (active) await loadSavedJobs();
    }
    void init();
    return () => { active = false; };
  }, [router]);

  async function remove(job: SavedJob) {
    const id = job.job_id || job.external_job_id;
    if (!id) return;
    setRemovingId(job.id);
    setError("");
    try {
      const response = await fetch("/api/saved-jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, source: job.source || "external" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to remove saved job.");
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove saved job.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="hh-dashboard hh-jobs-page">
      <div className="hh-shell">
        <DashboardHeader name={name} firstName={name.split(" ")[0]} roleLabel="Job Seeker" />
        <div className="hh-layout">
          <aside className="hh-sidebar">
            <nav aria-label="Dashboard navigation">
              <Link href="/dashboard" className="hh-nav-item"><span>⌂</span>Dashboard</Link>
              <Link href="/jobs" className="hh-nav-item"><span>⌘</span>Job Discovery</Link>
              <Link href="/dashboard#career-agent" className="hh-nav-item"><span>✦</span>Career Agent <em>AI</em></Link>
              <Link href="/applications" className="hh-nav-item"><span>▤</span>Applications</Link>
              <Link href="/saved-jobs" className="hh-nav-item is-active"><span>♡</span>Saved Jobs</Link>
              <Link href="/profile" className="hh-nav-item"><span>♙</span>Profile</Link>
            </nav>
          </aside>
          <section className="hh-content">
            <section className="hh-panel hh-discovery-results">
              <div className="hh-panel-heading">
                <div><small>YOUR COLLECTION</small><h2>Saved Jobs</h2><p>Roles you bookmarked are kept here for easy access.</p></div>
                <Link href="/jobs">Discover more →</Link>
              </div>
              {loading && <div className="hh-discovery-loading"><span className="hh-spinner" /><strong>Loading your saved jobs…</strong></div>}
              {!loading && error && <div className="hh-discovery-alert">{error}</div>}
              {!loading && !error && jobs.length === 0 && (
                <div className="hh-discovery-empty"><div className="hh-empty-icon">♡</div><div><strong>No saved jobs yet.</strong><p>Use the heart button on any opportunity to keep it here.</p></div><Link href="/jobs" className="hh-job-action">Explore jobs →</Link></div>
              )}
              {!loading && jobs.length > 0 && <div className="hh-discovery-list">
                {jobs.map((job) => (
                  <article key={job.id} className="hh-discovery-job">
                    <div className="hh-company-mark">{(job.company || "H").slice(0, 1).toUpperCase()}</div>
                    <div className="hh-discovery-job-main">
                      <div className="hh-discovery-job-top"><div><strong>{job.title || "Untitled role"}</strong><span>{job.company || "Company undisclosed"}</span></div>{typeof job.score === "number" && <b className="hh-discovery-match">{job.score}% Match</b>}</div>
                      <div className="hh-discovery-meta"><span>⌖ {job.location || "Location flexible"}</span><span>◷ {job.remote ? "Remote friendly" : "On-site / Hybrid"}</span><span>Saved {new Date(job.created_at).toLocaleDateString()}</span></div>
                      {job.salary_min || job.salary_max ? <p className="hh-discovery-reason">{job.currency || "INR"} {(job.salary_min || 0).toLocaleString()}–{(job.salary_max || job.salary_min || 0).toLocaleString()}</p> : null}
                    </div>
                    <div className="hh-discovery-actions">
                      {job.job_url && <a href={job.job_url} target="_blank" rel="noreferrer" className="hh-apply-button">View Job →</a>}
                      <button type="button" className="hh-save-button is-saved" onClick={() => remove(job)} disabled={removingId === job.id} aria-label="Remove saved job">{removingId === job.id ? "…" : "♥"}</button>
                    </div>
                  </article>
                ))}
              </div>}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
