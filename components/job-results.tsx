'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CandidateProfile, Job } from '@/lib/job-types';
import { sortMatches } from '@/lib/match-engine';
import { getLocationCluster } from '@/lib/location-utils';

interface JobResultsProps {
  profile: CandidateProfile;
}

type Match = {
  job: Job;
  score: number;
  opportunityScore: number;
  matchTier: string;
  reasons: string[];
  missingRequirements: string[];
};

const STORAGE_KEY = 'hiddenhire-tracking';
type TrackingStatus = 'saved' | 'applied' | 'rejected';
type Lane = 'all' | 'local' | 'india' | 'india-remote' | 'global-remote';

const laneLabels: Record<Lane, string> = {
  all: 'All',
  local: 'Delhi NCR',
  india: 'India',
  'india-remote': 'India Remote',
  'global-remote': 'Global Remote',
};

function getLane(job: Job): Exclude<Lane, 'all'> {
  if (job.remote) {
    return /india|remote - india|india remote/i.test(`${job.location} ${job.country}`)
      ? 'india-remote'
      : 'global-remote';
  }
  return getLocationCluster(job.location) === 'delhi-ncr' ? 'local' : 'india';
}

function formatSalary(job: Job) {
  if (job.salaryMin === null && job.salaryMax === null) return 'Salary not listed';
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return `${job.salaryCurrency} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`;
  }
  return `${job.salaryCurrency} ${(job.salaryMin ?? job.salaryMax ?? 0).toLocaleString()}+`;
}

function freshnessLabel(job: Job) {
  const timestamp = new Date(job.postedDate).getTime();
  if (!Number.isFinite(timestamp)) return 'Freshness unknown';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export function JobResults({ profile }: JobResultsProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane>('all');
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
    if (typeof window === 'undefined') return {};
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

        if (!response.ok) throw new Error('Unable to load relevant jobs.');

        const data = await response.json();
        if (!isMounted) return;

        const nextMatches = (data.results ?? data.matches ?? []) as Match[];
        setMatches(nextMatches);
        setSelectedId(nextMatches[0]?.job.id ?? null);
        setSummary({
          totalCollected: data.totalCollected ?? nextMatches.length,
          totalEligible: data.totalEligible ?? nextMatches.length,
          returned: data.returned ?? nextMatches.length,
        });
      } catch {
        if (!isMounted) return;
        const fallbackJobs = sortMatches(profile, [{
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
          requiredSkills: ['Financial reporting', 'Budgeting'],
          requiredExperience: 6,
          description: 'Fallback role for demo matching.',
          applicationUrl: 'https://example.com',
          source: 'Fallback',
          postedDate: '2026-09-01',
        }]) as Match[];
        setMatches(fallbackJobs);
        setSelectedId(fallbackJobs[0]?.job.id ?? null);
        setSummary({ totalCollected: fallbackJobs.length, totalEligible: fallbackJobs.length, returned: fallbackJobs.length });
        setError('Live search is temporarily unavailable; fallback results are shown.');
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

  const industries = useMemo(
    () => ['All', ...new Set(matches.map((match) => match.job.industry).filter(Boolean))],
    [matches],
  );

  const filteredMatches = useMemo(() => matches.filter((match) => {
    const { remoteOnly, indiaEligible, salary, jobType, industry } = filters;
    const passesLane = lane === 'all' || getLane(match.job) === lane;
    const passesRemote = !remoteOnly || match.job.remote;
    const passesIndia = !indiaEligible || match.job.indiaEligible;
    const passesSalary = !salary || (match.job.salaryMin !== null && match.job.salaryMin >= salary);
    const passesType = jobType === 'All' || match.job.employmentType === jobType;
    const passesIndustry = industry === 'All' || match.job.industry.toLowerCase() === industry.toLowerCase();
    return passesLane && passesRemote && passesIndia && passesSalary && passesType && passesIndustry;
  }), [filters, lane, matches]);

  const laneCounts = useMemo(() => {
    const counts: Record<Lane, number> = { all: matches.length, local: 0, india: 0, 'india-remote': 0, 'global-remote': 0 };
    matches.forEach((match) => { counts[getLane(match.job)] += 1; });
    return counts;
  }, [matches]);

  const selected = filteredMatches.find((match) => match.job.id === selectedId) ?? filteredMatches[0] ?? null;

  useEffect(() => {
    if (selected && selected.job.id !== selectedId) setSelectedId(selected.job.id);
  }, [selected, selectedId]);

  const setStatus = (jobId: string, nextStatus: TrackingStatus) => {
    setTracking((current) => ({ ...current, [jobId]: nextStatus }));
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-slate-100">Scanning live sources and ranking opportunities…</p>
        </div>
      </section>
    );
  }

  if (!matches.length) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <h3 className="text-lg font-semibold text-white">No strong matches found</h3>
          <p className="mt-2 text-sm text-slate-400">{error ?? 'Try widening your role or location preferences.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-3 pb-20 pt-5 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-cyan-950/10">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">AI Job Command Center</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white">{summary.totalCollected.toLocaleString()} opportunities scanned</h2>
              <p className="text-xs text-slate-500">{summary.totalEligible} eligible · {summary.returned} ranked · profile: {profile.targetJobTitle}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(laneLabels) as Lane[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLane(item)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${lane === item ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'}`}
                >
                  {laneLabels[item]} <span className="ml-1 text-slate-500">{laneCounts[item]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[11px] text-slate-400">
              <span className="mr-2">Remote only</span>
              <input type="checkbox" checked={filters.remoteOnly} onChange={(e) => setFilters((v) => ({ ...v, remoteOnly: e.target.checked }))} className="align-middle" />
            </label>
            <label className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-[11px] text-slate-400">
              <span className="mr-2">India eligible</span>
              <input type="checkbox" checked={filters.indiaEligible} onChange={(e) => setFilters((v) => ({ ...v, indiaEligible: e.target.checked }))} className="align-middle" />
            </label>
            <input type="number" value={filters.salary || ''} placeholder="Minimum salary" onChange={(e) => setFilters((v) => ({ ...v, salary: Number(e.target.value || 0) }))} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50" />
            <select value={filters.jobType} onChange={(e) => setFilters((v) => ({ ...v, jobType: e.target.value }))} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50">
              {['All', 'Full-time', 'Contract', 'Part-time'].map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={filters.industry} onChange={(e) => setFilters((v) => ({ ...v, industry: e.target.value }))} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50">
              {industries.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="border-b border-amber-500/15 bg-amber-500/5 px-4 py-2 text-xs text-amber-200">{error}</div>
        )}

        <div className="grid min-h-[620px] lg:grid-cols-[minmax(330px,0.9fr)_minmax(0,1.5fr)]">
          <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Opportunity stream</span>
              <span className="text-[10px] text-slate-600">{filteredMatches.length} shown</span>
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {filteredMatches.map((match) => {
                const active = selected?.job.id === match.job.id;
                const status = tracking[match.job.id];
                return (
                  <button
                    key={match.job.id}
                    type="button"
                    onClick={() => setSelectedId(match.job.id)}
                    className={`block w-full border-t border-white/[0.06] px-4 py-3 text-left transition ${active ? 'bg-cyan-400/[0.07] shadow-[inset_2px_0_0_rgba(34,211,238,.9)]' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${match.score >= 75 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : match.score >= 60 ? 'border-cyan-400/25 bg-cyan-400/5 text-cyan-200' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>
                        {match.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{match.job.title}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-400">{match.job.company}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                          <span>{match.job.remote ? 'Remote' : match.job.location}</span>
                          <span>·</span>
                          <span>{freshnessLabel(match.job)}</span>
                          {status && <><span>·</span><span className="text-cyan-300">{status}</span></>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            {selected ? (
              <article className="h-full p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[10px] font-bold text-cyan-100">{selected.score}% MATCH</span>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400">{selected.matchTier}</span>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400">Opportunity {selected.opportunityScore}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{selected.job.title}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-300">{selected.job.company}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-200">{selected.job.remote ? 'Remote' : selected.job.location}</span>
                      {!selected.job.remote && getLocationCluster(selected.job.location) === 'delhi-ncr' && <span className="rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 text-cyan-200">Delhi NCR</span>}
                      <span className="rounded-md border border-white/10 px-2 py-1 text-slate-400">{selected.job.employmentType}</span>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-slate-400">{freshnessLabel(selected.job)}</span>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-slate-400">{selected.job.source}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setStatus(selected.job.id, tracking[selected.job.id] === 'saved' ? 'rejected' : 'saved')} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/30">
                      {tracking[selected.job.id] === 'saved' ? '★ Saved' : '☆ Save'}
                    </button>
                    <a href={selected.job.applicationUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200">Apply now ↗</a>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Location fit</div>
                    <div className="mt-1 text-lg font-semibold text-white">{getLocationCluster(selected.job.location) === 'delhi-ncr' ? '94–100' : selected.job.remote ? '76+' : '64+'}</div>
                    <div className="text-[10px] text-slate-500">regional compatibility</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Compensation</div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{formatSalary(selected.job)}</div>
                    <div className="text-[10px] text-slate-500">salary signal</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Source trust</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-200">{selected.job.source === 'lever' || selected.job.source === 'greenhouse' ? 'Direct ATS' : 'Verified'}</div>
                    <div className="text-[10px] text-slate-500">application source</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <section>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Why this is ranked here</div>
                    <ul className="mt-3 space-y-2">
                      {selected.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2 text-xs leading-5 text-slate-200"><span className="text-emerald-300">✓</span>{reason}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Gaps / risk signals</div>
                    {selected.missingRequirements.length ? (
                      <ul className="mt-3 space-y-2">
                        {selected.missingRequirements.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-amber-100"><span className="text-amber-300">⚠</span>{item}</li>)}
                      </ul>
                    ) : <p className="mt-3 text-xs text-emerald-200">No major gaps identified.</p>}
                  </section>
                </div>

                <details className="mt-5 rounded-xl border border-white/10 bg-white/[0.02]">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-slate-300">Job intelligence</summary>
                  <div className="grid gap-4 border-t border-white/10 p-4 text-xs text-slate-300 sm:grid-cols-2">
                    <div><span className="text-slate-500">Work mode:</span> {selected.job.remote ? 'Remote' : 'On-site / Hybrid'}</div>
                    <div><span className="text-slate-500">Experience signal:</span> {selected.job.requiredExperience ? `${selected.job.requiredExperience}+ years` : 'Not specified'}</div>
                    <div><span className="text-slate-500">Skills:</span> {selected.job.requiredSkills.length ? selected.job.requiredSkills.join(', ') : 'Not specified'}</div>
                    <div><span className="text-slate-500">India eligibility:</span> {selected.job.indiaEligibilityStatus}</div>
                  </div>
                </details>
              </article>
            ) : (
              <div className="flex h-full min-h-[500px] items-center justify-center text-sm text-slate-500">Select an opportunity to inspect its intelligence.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
