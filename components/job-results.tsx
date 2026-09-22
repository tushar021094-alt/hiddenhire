'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CandidateProfile, Job } from '@/lib/job-types';
import { sortMatches } from '@/lib/match-engine';

interface JobResultsProps {
  profile: CandidateProfile;
}

const STORAGE_KEY = 'hiddenhire-tracking';

type TrackingStatus = 'saved' | 'applied' | 'rejected';

export function JobResults({ profile }: JobResultsProps) {
  const [matches, setMatches] = useState<Array<{ job: Job; score: number; opportunityScore: number; matchTier: string; reasons: string[]; missingRequirements: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ totalCollected: 0, totalEligible: 0, returned: 0 });
  const [filters, setFilters] = useState({
    remoteOnly: false,
    indiaEligible: false,
    salary: 0,
    jobType: 'All',
    industry: 'All',
  });
  const [tracking, setTracking] = useState<Record<string, TrackingStatus>>(() => {
    if (typeof window === "undefined") return {};

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    try {
      return JSON.parse(stored) as Record<string, TrackingStatus>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!profile.targetJobTitle) return;
    let isMounted = true;

    const runMatch = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/jobs/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });

        if (!response.ok) {
          throw new Error('Unable to load relevant jobs.');
        }

        const data = await response.json();
        if (!isMounted) return;
        setMatches(data.matches || []);
        setSummary({
          totalCollected: data.totalCollected ?? data.matches?.length ?? 0,
          totalEligible: data.totalEligible ?? data.matches?.length ?? 0,
          returned: data.returned ?? data.matches?.length ?? 0,
        });
      } catch {
        if (!isMounted) return;
        const fallbackJobs = sortMatches(profile, [
          {
            id: 'fallback-demo',
            title: 'Finance Manager',
            company: 'Example Company',
            location: 'Remote',
            country: 'India',
            remote: true,
            remoteStatus: 'TRUE',
            indiaEligible: true,
            indiaEligibilityStatus: 'YES',
            salaryMin: 45000,
            salaryMax: 60000,
            salaryCurrency: 'USD',
            employmentType: 'Full-time',
            industry: 'Finance',
            requiredSkills: ['Financial reporting', 'Reconciliation', 'AP/AR', 'Budgeting'],
            requiredExperience: 6,
            description: 'Fallback role for demo matching.',
            applicationUrl: 'https://example.com',
            source: 'Fallback',
            postedDate: '2026-09-01',
          },
          {
            id: 'fallback-demo-2',
            title: 'Senior Data Analyst',
            company: 'Example Company',
            location: 'Remote',
            country: 'India',
            remote: true,
            remoteStatus: 'TRUE',
            indiaEligible: true,
            indiaEligibilityStatus: 'YES',
            salaryMin: 50000,
            salaryMax: 70000,
            salaryCurrency: 'USD',
            employmentType: 'Full-time',
            industry: 'Analytics',
            requiredSkills: ['SQL', 'Python', 'Dashboarding'],
            requiredExperience: 5,
            description: 'Fallback role for demo matching.',
            applicationUrl: 'https://example.com',
            source: 'Fallback',
            postedDate: '2026-09-01',
          }
        ]);
        setMatches(fallbackJobs);
        setSummary({ totalCollected: fallbackJobs.length, totalEligible: fallbackJobs.length, returned: fallbackJobs.length });
        setError('The live match service is unavailable; fallback demo results are shown.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    runMatch();
    return () => {
      isMounted = false;
    };
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
  }, [tracking]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const { remoteOnly, indiaEligible, salary, jobType, industry } = filters;
      const passesRemote = !remoteOnly || match.job.remote;
      const passesIndia = !indiaEligible || match.job.indiaEligible;
      const passesSalary = !salary || (match.job.salaryMin !== null && match.job.salaryMin >= salary);
      const passesType = jobType === 'All' || match.job.employmentType === jobType;
      const passesIndustry = industry === 'All' || match.job.industry.toLowerCase() === industry.toLowerCase();
      return passesRemote && passesIndia && passesSalary && passesType && passesIndustry;
    });
  }, [filters, matches]);

  const industries = useMemo(
    () => ['All', ...new Set(matches.map((match) => match.job.industry))],
    [matches]
  );

  const jobTypes = ['All', 'Full-time', 'Contract', 'Part-time'];

  const setStatus = (jobId: string, nextStatus: TrackingStatus) => {
    setTracking((current) => ({ ...current, [jobId]: nextStatus }));
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-cyan-500/20 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="mt-4 text-lg font-medium text-slate-100">Finding your best-fit jobs…</p>
        </div>
      </section>
    );
  }

  if (error && matches.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center text-amber-100">
          <h3 className="text-xl font-semibold">No matches found</h3>
          <p className="mt-2 text-sm text-amber-50/70">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Matches</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{summary.totalCollected || matches.length} opportunities discovered</h2>
          </div>
          <div className="text-sm text-slate-300">{summary.returned || filteredMatches.length} best matches for you</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Remote only</span>
            <input
              type="checkbox"
              checked={filters.remoteOnly}
              onChange={(event) => setFilters((current) => ({ ...current, remoteOnly: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800"
            />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">India eligible</span>
            <input
              type="checkbox"
              checked={filters.indiaEligible}
              onChange={(event) => setFilters((current) => ({ ...current, indiaEligible: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800"
            />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Min salary</span>
            <input
              type="number"
              value={filters.salary}
              onChange={(event) => setFilters((current) => ({ ...current, salary: Number(event.target.value || 0) }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 outline-none"
            />
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Job type</span>
            <select
              value={filters.jobType}
              onChange={(event) => setFilters((current) => ({ ...current, jobType: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 outline-none"
            >
              {jobTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Industry</span>
            <select
              value={filters.industry}
              onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 outline-none"
            >
              {industries.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/40 p-8 text-center text-slate-200">
          <p className="text-lg font-medium">No results match the current filters.</p>
          <p className="mt-2 text-sm text-slate-400">Try widening your salary or location preferences.</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredMatches.map((match) => {
            const status = tracking[match.job.id];
            return (
              <article key={match.job.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-slate-950/30">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-cyan-300">{match.score}% MATCH</span>
                      <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-indigo-200">{match.matchTier}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Opportunity {match.opportunityScore}</span>
                    </div>
                    <h3 className="mt-3 text-3xl font-semibold text-white">{match.job.title}</h3>
                    <p className="mt-2 text-lg text-slate-200">{match.job.company}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200">
                      <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1">{match.job.remote ? 'Remote' : match.job.location}</span>
                      <span className={`rounded-full border px-3 py-1 ${match.job.indiaEligibilityStatus === 'YES' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : match.job.indiaEligibilityStatus === 'UNKNOWN' ? 'border-amber-500/20 bg-amber-500/10 text-amber-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-100'}`}>
                        {match.job.indiaEligibilityStatus === 'YES' ? 'Remote — India eligible' : match.job.indiaEligibilityStatus === 'UNKNOWN' ? 'Remote — eligibility unknown' : 'Remote — India not eligible'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1">
                        {match.job.salaryMin !== null && match.job.salaryMax !== null
                          ? `${match.job.salaryCurrency} ${match.job.salaryMin.toLocaleString()}–${match.job.salaryMax.toLocaleString()}`
                          : 'Salary not listed'}
                      </span>
                      {match.job.isDemo ? (
                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-violet-100">Demo data</span>
                      ) : (
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-sky-100">{match.job.source}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus(match.job.id, status === 'saved' ? 'rejected' : 'saved')}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${status === 'saved' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-slate-900 text-slate-200'}`}
                    >
                      {status === 'saved' ? 'Saved' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(match.job.id, status === 'applied' ? 'rejected' : 'applied')}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${status === 'applied' ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-slate-900 text-slate-200'}`}
                    >
                      {status === 'applied' ? 'Applied' : 'Apply'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(match.job.id, status === 'rejected' ? 'saved' : 'rejected')}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${status === 'rejected' ? 'border-rose-400 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-slate-900 text-slate-200'}`}
                    >
                      {status === 'rejected' ? 'Rejected' : 'Skip'}
                    </button>
                    <a href={match.job.applicationUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                      Apply
                    </a>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Why you match</div>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {match.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-2">
                          <span className="mt-0.5 text-emerald-300">✓</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Missing</div>
                    {match.missingRequirements.length ? (
                      <ul className="space-y-2 text-sm text-amber-100">
                        {match.missingRequirements.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 text-amber-300">⚠</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-emerald-200">No major gaps identified.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
