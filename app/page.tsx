"use client";

import { FormEvent, useState } from "react";
import type { MatchResult } from "@/lib/types";

const starterSkills = "FP&A, financial analysis, forecasting, Excel";

export default function Home() {
  const [role, setRole] = useState("Finance Manager");
  const [skills, setSkills] = useState(starterSkills);
  const [experience, setExperience] = useState("6");
  const [salary, setSalary] = useState("30000");
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function findJobs(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          experience: Number(experience),
          location: "India",
          remoteOnly,
          minSalary: Number(salary),
        }),
      });
      const data = await response.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="hero-glow" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark">H</div>
          <div className="text-lg font-bold tracking-tight">HiddenHire</div>
        </div>
        <div className="hidden items-center gap-7 text-sm text-white/50 sm:flex">
          <span>How it works</span><span>Company sources</span><span>Explainable matching</span>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">Built for focused job search</div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="eyebrow"><span className="pulse-dot" /> Intelligent job discovery for India</div>
          <h1 className="mt-7 text-5xl font-bold tracking-[-0.045em] sm:text-7xl">
            Find the jobs that
            <span className="gradient-text block">actually fit you.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            HiddenHire discovers opportunities from employer sources and explains why each role matches your skills, experience, location and compensation.
          </p>
        </div>

        <form onSubmit={findJobs} className="search-panel mx-auto mt-12 max-w-6xl">
          <div className="panel-top">
            <div>
              <div className="text-sm font-semibold text-white">Build your job profile</div>
              <div className="mt-1 text-xs text-white/40">Tell us what a good opportunity looks like.</div>
            </div>
            <div className="secure-pill">● Private by design</div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Target role"><input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Finance Manager" /></Field>
            <Field label="Core skills"><input value={skills} onChange={e => setSkills(e.target.value)} placeholder="FP&A, Excel, forecasting" /></Field>
            <Field label="Experience"><div className="input-suffix"><input type="number" min="0" value={experience} onChange={e => setExperience(e.target.value)} /><span>years</span></div></Field>
            <Field label="Minimum annual salary"><div className="input-suffix"><span>$</span><input type="number" min="0" value={salary} onChange={e => setSalary(e.target.value)} /><span>USD</span></div></Field>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="toggle-row">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} />
              <span className="toggle" />
              <span><strong>Remote-first</strong><small>Work from India</small></span>
            </label>
            <button disabled={loading} className="primary-button">{loading ? "Finding your matches…" : "Find my matches"} <span>→</span></button>
          </div>
        </form>

        <div className="mx-auto mt-5 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/30">
          <span>✓ Employer sources</span><span>✓ Explainable scoring</span><span>✓ Direct application links</span><span>✓ No generic job-board noise</span>
        </div>
      </section>

      {searched && (
        <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="section-kicker">YOUR MATCHES</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Roles ranked around your profile</h2>
            </div>
            <div className="text-xs text-white/35">{results.length} opportunities found</div>
          </div>

          {loading ? (
            <div className="loading-card">Analyzing employer roles against your profile<span className="loading-dots">...</span></div>
          ) : results.length === 0 ? (
            <div className="empty-card"><div className="empty-icon">⌕</div><h3>No matches yet</h3><p>Try a broader role, lower salary threshold, or turn off Remote-first.</p></div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {results.map((job) => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </section>
      )}

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="mb-7 max-w-xl">
          <div className="section-kicker">HOW HIDDENHIRE WORKS</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Less searching. More signal.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["01", "Discover", "Find opportunities through employer career sources and public feeds."],
            ["02", "Understand", "See a transparent match score, reasons and potential skill gaps."],
            ["03", "Apply", "Go straight to the employer's application page when you're ready."]
          ].map(([n,t,d]) => (
            <div className="feature-card" key={n}><div className="feature-number">{n}</div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.07] px-5 py-8 text-center text-xs text-white/30">
        HiddenHire · Focused job discovery · Direct employer applications
      </footer>
    </main>
  );
}

function JobCard({ job }: { job: MatchResult }) {
  const score = Math.max(0, Math.min(100, job.score));
  return (
    <article className="job-card">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="company-line"><span className="company-logo">{job.company.slice(0, 1).toUpperCase()}</span><span>{job.company}</span></div>
          <h3 className="mt-4 truncate text-xl font-semibold tracking-tight">{job.title}</h3>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40"><span>{job.location}</span><span>•</span><span>Remote</span><span>•</span><span>Full-time</span></div>
        </div>
        <div className="score-ring" style={{"--score": `${score * 3.6}deg`} as React.CSSProperties}><strong>{score}</strong><span>MATCH</span></div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Salary" value={job.salaryMin ? "$" + job.salaryMin.toLocaleString() + "–$" + (job.salaryMax ?? job.salaryMin).toLocaleString() : "Not disclosed"} />
        <Stat label="Location fit" value={job.indiaEligible ? "India eligible" : "Verify"} />
      </div>

      <p className="mt-5 text-sm leading-6 text-white/50">{job.description}</p>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Why this matches</div>
        <ul className="mt-2 space-y-2 text-sm text-white/65">{job.reasons.slice(0, 4).map((r) => <li key={r}><span className="mr-2 text-cyan-300">✓</span>{r}</li>)}</ul>
      </div>

      {job.gaps.length > 0 && <div className="mt-3 text-xs text-amber-300/70">Potential gap · {job.gaps.join(" · ")}</div>}
      <a href={job.url} target="_blank" rel="noreferrer" className="apply-button mt-5">View application <span>↗</span></a>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{label}<div className="mt-2">{children}</div></label>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-box"><div>{label}</div><strong>{value}</strong></div>;
}
