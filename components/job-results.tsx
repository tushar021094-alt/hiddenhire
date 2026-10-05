'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CandidateProfile, Job } from '@/lib/job-types';
import { sortMatches } from '@/lib/match-engine';
import { getLocationCluster } from '@/lib/location-utils';

interface JobResultsProps {
  profile: CandidateProfile;
}

type ScoreBreakdown = {
  role: number;
  skills: number;
  experience: number;
  location: number;
  salary: number;
  industry: number;
  seniority: number;
};

type Match = {
  job: Job;
  score: number;
  opportunityScore: number;
  matchTier: string;
  reasons: string[];
  missingRequirements: string[];
  scoreBreakdown?: ScoreBreakdown;
};

const STORAGE_KEY = 'hiddenhire-tracking';
type TrackingStatus = 'saved' | 'applied' | 'rejected';
type Lane = 'all' | 'local' | 'india' | 'india-remote' | 'global-remote';
type RankingFocus = 'match' | 'local' | 'fresh' | 'salary' | 'priority';

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



function parseNaturalQuery(query: string, profile: CandidateProfile) {
  const text = query.trim().toLowerCase();
  const next = { ...profile };
  const locations = ['delhi', 'noida', 'greater noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad', 'pune', 'chennai'];
  const location = locations.find((item) => text.includes(item));
  if (location) next.preferredLocations = [location];
  if (/\b(remote|work from home|wfh)\b/.test(text)) next.remoteOnly = true;
  else if (/\b(on[- ]site|onsite|office|hybrid)\b/.test(text)) next.remoteOnly = false;

  const lakhMatch = text.match(/(?:above|over|at least|min(?:imum)?|>=?)\s*(?:₹|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/);
  const croreMatch = text.match(/(?:above|over|at least|min(?:imum)?|>=?)\s*(?:₹|inr)?\s*(\d+(?:\.\d+)?)\s*(?:crore|cr)\b/);
  const rawMatch = text.match(/(?:above|over|at least|min(?:imum)?|>=?)\s*(?:₹|inr)?\s*(\d[\d,]*)\b/);
  if (lakhMatch) next.minimumSalary = Math.round(Number(lakhMatch[1]) * 100000);
  else if (croreMatch) next.minimumSalary = Math.round(Number(croreMatch[1]) * 10000000);
  else if (rawMatch) next.minimumSalary = Number(rawMatch[1].replace(/,/g, ''));

  return next;
}

function freshnessScore(job: Job) {
  const timestamp = new Date(job.postedDate).getTime();
  if (!Number.isFinite(timestamp)) return 25;
  const days = Math.max(0, (Date.now() - timestamp) / 86400000);
  return Math.max(0, Math.round(100 - days * 8));
}

function priorityScore(match: Match) {
  const localBoost = getLocationCluster(match.job.location) === 'delhi-ncr' ? 12 : 0;
  const directBoost = match.job.source === 'lever' || match.job.source === 'greenhouse' ? 5 : 0;
  return Math.min(100, Math.round(match.score * 0.58 + match.opportunityScore * 0.22 + freshnessScore(match.job) * 0.10 + localBoost + directBoost));
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
  const [naturalQuery, setNaturalQuery] = useState('');
  const [rankingFocus, setRankingFocus] = useState<RankingFocus>('priority');
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

  const queryIntent = useMemo(() => parseNaturalQuery(naturalQuery, profile), [naturalQuery, profile]);

  const filteredMatches = useMemo(() => {
    const queryText = naturalQuery.trim().toLowerCase();
    const queryTokens = queryText.split(/\s+/).filter((token) => token.length > 2);
    const roleTerms = queryTokens.filter((token) => !['with', 'above', 'over', 'at', 'least', 'lakh', 'lac', 'remote', 'onsite', 'on-site', 'hybrid', 'office', 'jobs', 'job', 'in', 'for'].includes(token));
    const source = matches.filter((match) => {
      const { remoteOnly, indiaEligible, salary, jobType, industry } = filters;
      const passesLane = lane === 'all' || getLane(match.job) === lane;
      const passesRemote = !remoteOnly || match.job.remote;
      const passesIndia = !indiaEligible || match.job.indiaEligible;
      const passesSalary = !salary || (match.job.salaryMin !== null && match.job.salaryMin >= salary);
      const passesType = jobType === 'All' || match.job.employmentType === jobType;
      const passesIndustry = industry === 'All' || match.job.industry.toLowerCase() === industry.toLowerCase();
      const searchable = `${match.job.title} ${match.job.company} ${match.job.location} ${match.job.description}`.toLowerCase();
      const queryMatch = !queryText || roleTerms.length === 0 || roleTerms.every((token) => searchable.includes(token));
      const queryLocation = !queryIntent.preferredLocations?.length || getLocationCluster(match.job.location) === getLocationCluster(queryIntent.preferredLocations[0]) || match.job.location.toLowerCase().includes(queryIntent.preferredLocations[0].toLowerCase());
      const queryRemote = !naturalQuery || !queryIntent.remoteOnly || match.job.remote;
      const querySalary = !naturalQuery || !queryIntent.minimumSalary || match.job.salaryMin === null || match.job.salaryMin >= queryIntent.minimumSalary;
      return passesLane && passesRemote && passesIndia && passesSalary && passesType && passesIndustry && queryMatch && queryLocation && queryRemote && querySalary;
    });

    return [...source].sort((a, b) => {
      if (rankingFocus === 'local') return (getLocationCluster(b.job.location) === 'delhi-ncr' ? 1 : 0) - (getLocationCluster(a.job.location) === 'delhi-ncr' ? 1 : 0) || b.score - a.score;
      if (rankingFocus === 'fresh') return freshnessScore(b.job) - freshnessScore(a.job) || b.score - a.score;
      if (rankingFocus === 'salary') return (b.job.salaryMax ?? b.job.salaryMin ?? 0) - (a.job.salaryMax ?? a.job.salaryMin ?? 0) || b.score - a.score;
      if (rankingFocus === 'match') return b.score - a.score || b.opportunityScore - a.opportunityScore;
      return priorityScore(b) - priorityScore(a) || b.score - a.score;
    });
  }, [filters, lane, matches, naturalQuery, profile, queryIntent, rankingFocus]);

  const laneCounts = useMemo(() => {
    const counts: Record<Lane, number> = { all: matches.length, local: 0, india: 0, 'india-remote': 0, 'global-remote': 0 };
    matches.forEach((match) => { counts[getLane(match.job)] += 1; });
    return counts;
  }, [matches]);

  const selected = filteredMatches.find((match) => match.job.id === selectedId) ?? filteredMatches[0] ?? null;

  const setStatus = (jobId: string, nextStatus: TrackingStatus) => {
    setTracking((current) => {
      const next = { ...current };
      if (nextStatus === 'saved' && next[jobId] === 'saved') delete next[jobId];
      else next[jobId] = nextStatus;
      return next;
    });
  };

  const applicationReadiness = selected
    ? Math.min(100, Math.round(selected.score * 0.65 + selected.opportunityScore * 0.15 + (selected.missingRequirements.length ? 20 : 35)))
    : 0;

  const tailoredPitch = selected
    ? `I am interested in the ${selected.job.title} opportunity at ${selected.job.company}. My background aligns with ${selected.reasons.slice(0, 3).join(', ')}. I would welcome the opportunity to discuss how I can contribute to the role.`
    : '';

  async function copyPitch() {
    if (!tailoredPitch || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(tailoredPitch);
  }

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

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] px-3 py-2">
              <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-300">Natural language search</div>
              <input value={naturalQuery} onChange={(e) => setNaturalQuery(e.target.value)} placeholder="Try: finance manager in Noida above 15 lakh, onsite" className="mt-1 w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600" />
            </div>
            <select value={rankingFocus} onChange={(e) => setRankingFocus(e.target.value as RankingFocus)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400/50">
              <option value="priority">Rank: AI Priority</option>
              <option value="match">Rank: Match</option>
              <option value="local">Rank: Local first</option>
              <option value="fresh">Rank: Freshest</option>
              <option value="salary">Rank: Highest salary</option>
            </select>
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
              <span className="text-[10px] text-slate-600">{filteredMatches.length} shown · {naturalQuery ? 'AI query active' : 'profile ranking'}</span>
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
                      <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-bold text-emerald-200">{priorityScore(selected)} PRIORITY</span>
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
                    <button type="button" onClick={() => setStatus(selected.job.id, 'applied')} className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs font-medium text-emerald-200 hover:border-emerald-400/40">
                      {tracking[selected.job.id] === 'applied' ? '✓ Tracked' : 'Track applied'}
                    </button>
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

                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Match signal matrix</div>
                    <div className="text-[10px] text-slate-600">weighted contribution</div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(selected.scoreBreakdown ?? {}).map(([label, value]) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-[10px] text-slate-400"><span className="capitalize">{label}</span><span>{value}</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Number(value) * 2.5)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.025] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Application Copilot</div>
                      <h4 className="mt-1 text-sm font-semibold text-white">Ready to apply: {applicationReadiness}%</h4>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">A pre-submit checklist based on the job requirements and your current profile. HiddenHire will never submit an external application without your action.</p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${applicationReadiness >= 80 ? 'border-emerald-400/25 bg-emerald-400/5 text-emerald-200' : 'border-amber-400/25 bg-amber-400/5 text-amber-200'}`}>
                      {applicationReadiness >= 80 ? 'READY' : 'REVIEW GAPS'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs"><span className="text-emerald-300">✓</span> Role alignment {selected.score >= 70 ? 'strong' : 'needs review'}</div>
                    <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs"><span className={selected.missingRequirements.length ? 'text-amber-300' : 'text-emerald-300'}>{selected.missingRequirements.length ? '⚠' : '✓'}</span> {selected.missingRequirements.length ? `${selected.missingRequirements.length} gap(s) to review` : 'No major gaps'}</div>
                    <div className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs"><span className="text-cyan-300">↗</span> Source: {selected.job.source}</div>
                  </div>
                  <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Tailored application pitch</div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{tailoredPitch}</p>
                    <button type="button" onClick={() => void copyPitch()} className="mt-3 rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200">Copy pitch</button>
                  </div>
                </section>

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
