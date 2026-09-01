'use client';

import { useState } from 'react';
import type { CandidateProfile } from '@/lib/job-types';

const defaultProfile: CandidateProfile = {
  resumeText: 'Finance professional with 7 years of experience across accounting, controls, and reporting. Strong financial reporting, reconciliation, AP/AR, budgeting, and operational finance support.',
  targetJobTitle: 'Finance Manager',
  yearsOfExperience: 7,
  minimumSalary: 45000,
  preferredCurrency: 'USD',
  preferredCountries: ['India', 'United States'],
  remoteOnly: true,
  preferredIndustries: ['Finance', 'Accounting'],
  keySkills: ['Financial reporting', 'Reconciliation', 'AP/AR', 'Budgeting', 'Forecasting'],
};

interface CandidateFormProps {
  onSubmit: (profile: CandidateProfile) => void;
}

export function CandidateForm({ onSubmit }: CandidateFormProps) {
  const [form, setForm] = useState<CandidateProfile>(defaultProfile);

  const handleChange = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Candidate profile</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Tell HiddenHire what you want</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2 text-sm text-slate-200">
            <span className="mb-2 block font-medium">Resume upload</span>
            <textarea
              value={form.resumeText}
              onChange={(event) => handleChange('resumeText', event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
              placeholder="Paste your resume summary or upload text later"
            />
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-2 block font-medium">Target job title</span>
            <input
              value={form.targetJobTitle}
              onChange={(event) => handleChange('targetJobTitle', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-2 block font-medium">Years of experience</span>
            <input
              type="number"
              min={0}
              value={form.yearsOfExperience}
              onChange={(event) => handleChange('yearsOfExperience', Number(event.target.value || 0))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-2 block font-medium">Minimum salary</span>
            <input
              type="number"
              value={form.minimumSalary}
              onChange={(event) => handleChange('minimumSalary', Number(event.target.value || 0))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-2 block font-medium">Preferred currency</span>
            <select
              value={form.preferredCurrency}
              onChange={(event) => handleChange('preferredCurrency', event.target.value as CandidateProfile['preferredCurrency'])}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <label className="md:col-span-2 text-sm text-slate-200">
            <span className="mb-2 block font-medium">Preferred countries</span>
            <input
              value={form.preferredCountries.join(', ')}
              onChange={(event) =>
                handleChange(
                  'preferredCountries',
                  event.target.value.split(',').map((country) => country.trim()).filter(Boolean)
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-200 md:col-span-2">
            <input
              type="checkbox"
              checked={form.remoteOnly}
              onChange={(event) => handleChange('remoteOnly', event.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800"
            />
            Remote-only roles only
          </label>

          <label className="md:col-span-2 text-sm text-slate-200">
            <span className="mb-2 block font-medium">Preferred industries</span>
            <input
              value={form.preferredIndustries.join(', ')}
              onChange={(event) =>
                handleChange(
                  'preferredIndustries',
                  event.target.value.split(',').map((industry) => industry.trim()).filter(Boolean)
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="md:col-span-2 text-sm text-slate-200">
            <span className="mb-2 block font-medium">Key skills</span>
            <input
              value={form.keySkills.join(', ')}
              onChange={(event) =>
                handleChange(
                  'keySkills',
                  event.target.value.split(',').map((skill) => skill.trim()).filter(Boolean)
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <button
            type="submit"
            className="md:col-span-2 w-full rounded-2xl bg-cyan-300 px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Find My Jobs
          </button>
        </form>
      </div>
    </section>
  );
}
