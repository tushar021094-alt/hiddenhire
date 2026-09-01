'use client';

import { useMemo, useState } from 'react';
import { CandidateForm } from '@/components/candidate-form';
import { JobResults } from '@/components/job-results';
import type { CandidateProfile } from '@/lib/job-types';

const heroStats = [
  { label: 'Remote jobs', value: '2.4k+' },
  { label: 'India-eligible roles', value: '870+' },
  { label: 'Average match confidence', value: '94%' },
];

const benefits = [
  {
    title: 'Explainable fit',
    description: 'See the exact reasons a role is a strong match and what is still missing.',
  },
  {
    title: 'India-first filtering',
    description: 'Prioritize roles that explicitly hire candidates in India and remote-first teams.',
  },
  {
    title: 'Direct apply flow',
    description: 'Skip the noise and go straight to the role with salary and eligibility context.',
  },
];

const steps = [
  'Upload your resume or paste a profile summary.',
  'Set your role, salary, and remote preferences.',
  'Review job match scores and clear reasons to apply.',
];

const exampleJob = {
  title: 'Finance Manager',
  company: 'Northstar Capital',
  location: 'Remote',
  remoteLabel: 'Remote — India eligible',
  salary: '$45,000–$60,000',
  match: '96% MATCH',
  reasons: ['6+ years finance experience', 'Financial reporting', 'Reconciliation', 'AP/AR'],
  missing: ['US GAAP'],
};

export default function HomePage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  const profileSummary = useMemo(() => {
    if (!profile) return null;
    return `${profile.targetJobTitle} · ${profile.yearsOfExperience}+ years · ${profile.minimumSalary.toLocaleString()} ${profile.preferredCurrency}`;
  }, [profile]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-lg font-bold text-slate-950">H</div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">HiddenHire</div>
          </div>
        </div>
        <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          V1 Beta
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
              Remote & international jobs hiring from India
            </div>
            <h1 className="max-w-xl text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Stop searching.<br />
              <span className="text-cyan-300">Start finding.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              HiddenHire finds high-match opportunities—including remote international jobs hiring from India—and tells you exactly why you should apply.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a href="#candidate-profile" className="rounded-2xl bg-cyan-300 px-6 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-cyan-200">
                Find My Jobs
              </a>
              <a href="#how-it-works" className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-3.5 text-base font-semibold text-white transition hover:border-cyan-400/40 hover:text-cyan-200">
                See how it works
              </a>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-900/20">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live example</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{exampleJob.title}</h2>
              </div>
              <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300">
                {exampleJob.match}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="text-lg font-semibold text-white">{exampleJob.company}</div>
              <div className="mt-2 text-sm text-slate-300">{exampleJob.location} • {exampleJob.remoteLabel}</div>
              <div className="mt-4 text-base font-medium text-cyan-200">{exampleJob.salary}</div>

              <div className="mt-6">
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Why you match</div>
                <ul className="space-y-2 text-sm text-slate-200">
                  {exampleJob.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2">
                      <span className="text-emerald-300">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Missing</div>
                <ul className="space-y-2 text-sm text-amber-100">
                  {exampleJob.missing.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-amber-300">⚠</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Benefits</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Built to reduce wasted applications</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">✓</div>
              <h3 className="text-xl font-semibold text-white">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="candidate-profile" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <CandidateForm onSubmit={setProfile} />
      </section>

      {profile && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Active profile: {profileSummary}
          </div>
          <JobResults profile={profile} />
        </section>
      )}

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Simple flow, better outcomes</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-slate-950">0{index + 1}</div>
              <p className="text-base leading-7 text-slate-200">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="font-semibold text-white">HiddenHire</div>
          <div>Remote-first opportunities. Better matches. Faster applications.</div>
        </div>
      </footer>
    </main>
  );
}
