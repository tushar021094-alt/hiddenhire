"use client";

import { useState } from "react";

export default function Home() {
  const [role, setRole] = useState("Finance Manager");
  const [salary, setSalary] = useState("30000");
  const [remote, setRemote] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="text-xl font-bold tracking-tight">HiddenHire<span className="text-cyan-400">.</span></div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">V1 Beta</div>
      </nav>

      <section className="mx-auto max-w-4xl pb-16 pt-20 text-center sm:pt-28">
        <div className="mb-5 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
          Remote & international jobs hiring from India
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Stop searching.<br />
          <span className="text-cyan-300">Find jobs you should apply to.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
          Tell us what you want. HiddenHire ranks opportunities by fit, salary, remote eligibility and the reasons you match.
        </p>

        <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left shadow-2xl shadow-black/30 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-white/70">Target role<input value={role} onChange={e => setRole(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400/50" /></label>
            <label className="text-sm text-white/70">Minimum annual salary (USD)<input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400/50" /></label>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} className="h-4 w-4" />
            Remote / work from India
          </label>
          <button onClick={() => setSubmitted(true)} className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3.5 font-semibold text-black transition hover:bg-cyan-200">
            Find my jobs
          </button>
          {submitted && (
            <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <div className="text-sm font-semibold text-cyan-300">Search profile created</div>
              <p className="mt-2 text-sm text-white/60">We&apos;ll use <b className="text-white">{role}</b>, {remote ? "remote India eligibility" : "your location preference"}, and a <b className="text-white">${Number(salary).toLocaleString()}</b> minimum target to rank opportunities.</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">Job discovery engine coming next — this is the first working V1 interface.</div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 pb-20 sm:grid-cols-3">
        {[['01','Discover','Find remote and international opportunities beyond the usual job-board results.'],['02','Match','Get an explainable match score based on your profile and the actual job requirements.'],['03','Apply','See salary, eligibility and a direct application link — without wasting hours searching.']].map(([n,t,d]) => <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"><div className="text-xs text-cyan-300">{n}</div><h2 className="mt-4 text-xl font-semibold">{t}</h2><p className="mt-2 text-sm leading-6 text-white/50">{d}</p></div>)}
      </section>
    </main>
  );
}
