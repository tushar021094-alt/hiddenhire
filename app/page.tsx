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

  async function findJobs(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
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
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#070a10]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="text-xl font-bold tracking-tight">HiddenHire<span className="text-cyan-400">.</span></div>
        <div className="flex items-center gap-3 text-xs text-white/50"><span>Company sources</span><span>•</span><span>Explainable matching</span></div>
      </nav>

      <section className="mx-auto max-w-7xl px-5 pb-14 pt-12 sm:px-8 sm:pt-20">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">Remote & international jobs hiring from India</div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">Stop searching.<br /><span className="text-cyan-300">Find jobs you should see.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">HiddenHire discovers opportunities from company sources and ranks them against your role, skills, compensation and work-location requirements.</p>
        </div>

        <form onSubmit={findJobs} className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Target role"><input value={role} onChange={e => setRole(e.target.value)} /></Field>
            <Field label="Experience (years)"><input type="number" min="0" value={experience} onChange={e => setExperience(e.target.value)} /></Field>
            <Field label="Minimum annual salary (USD)"><input type="number" min="0" value={salary} onChange={e => setSalary(e.target.value)} /></Field>
            <Field label="Skills (comma separated)"><input value={skills} onChange={e => setSkills(e.target.value)} /></Field>
          </div>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white/65"><input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="h-4 w-4 accent-cyan-300" />Remote + work from India only</label>
            <button disabled={loading} className="rounded-xl bg-cyan-300 px-7 py-3.5 font-semibold text-black transition hover:bg-cyan-200 disabled:opacity-60">{loading ? "Matching jobs…" : "Find my jobs"}</button>
          </div>
        </form>
      </section>

      {results.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="mb-5 flex items-end justify-between">
            <div><div className="text-sm text-cyan-300">MATCH RESULTS</div><h2 className="mt-1 text-2xl font-semibold">Opportunities ranked for you</h2></div>
            <div className="text-xs text-white/35">Demo source layer • direct company links</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {results.map((job) => (
              <article key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex items-start justify-between gap-5">
                  <div><h3 className="text-xl font-semibold">{job.title}</h3><p className="mt-1 text-sm text-white/50">{job.company} · {job.location}</p></div>
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-center"><div className="text-2xl font-bold text-cyan-300">{job.score}</div><div className="text-[10px] uppercase tracking-wider text-white/40">match</div></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Salary" value={job.salaryMin ? "$" + job.salaryMin.toLocaleString() + "–$" + (job.salaryMax ?? job.salaryMin).toLocaleString() : "Not disclosed"} />
                  <Stat label="Eligibility" value={job.indiaEligible ? "India eligible" : "Verify"} />
                </div>
                <p className="mt-5 text-sm leading-6 text-white/55">{job.description}</p>
                <div className="mt-5"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">Why it matches</div><ul className="space-y-1 text-sm text-white/65">{job.reasons.map((r) => <li key={r}>✓ {r}</li>)}</ul></div>
                {job.gaps.length > 0 && <div className="mt-4 text-xs text-amber-300/75">{job.gaps.join(" · ")}</div>}
                <a href={job.url} target="_blank" rel="noreferrer" className="mt-6 block rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/5">View direct application source ↗</a>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:grid-cols-3 sm:px-8">
        {[["01","Discover","Company careers and public feeds instead of relying on generic job-board scraping."],["02","Match","Transparent scoring across role, skills, experience, location and compensation."],["03","Apply","See the reason for the match and go directly to the employer's application page."]].map(([n,t,d]) => <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="text-xs text-cyan-300">{n}</div><h2 className="mt-4 text-xl font-semibold">{t}</h2><p className="mt-2 text-sm leading-6 text-white/50">{d}</p></div>)}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm text-white/60">{label}<div className="mt-2 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-white/10 [&>input]:bg-black/30 [&>input]:px-4 [&>input]:py-3 [&>input]:outline-none [&>input]:focus:border-cyan-400/50">{children}</div></label>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div><div className="mt-1 text-white/75">{value}</div></div>;
}