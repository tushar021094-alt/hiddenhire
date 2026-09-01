import type { CandidateProfile, Job, SalaryCurrency } from './job-types';
import { seedJobs } from './job-data';
import { verifiedCompanyRegistry } from './company-registry';

export type DiscoveryQuery = Partial<CandidateProfile> & {
  targetRole?: string;
  country?: string;
  industry?: string;
  remoteOnly?: boolean;
  minimumSalary?: number;
  experience?: number;
  indiaOnly?: boolean;
};

export interface JobSource {
  name: string;
  fetchJobs(query: DiscoveryQuery): Promise<Job[]>;
}

export interface CompanyDiscoveryMetrics {
  companiesConfigured: number;
  companiesQueried: number;
  companiesSucceeded: number;
  companiesFailed: number;
  jobsFetched: number;
  jobsNormalized: number;
  jobsRejected: number;
}

interface JobSourceWithMetrics extends JobSource {
  fetchJobsWithMetrics(query: DiscoveryQuery): Promise<{ jobs: Job[]; metrics: CompanyDiscoveryMetrics }>;
}

export interface SourceConfig {
  greenhouse: boolean;
  lever: boolean;
  ashby: boolean;
  remoteok: boolean;
  remotive: boolean;
  companyDiscovery: boolean;
  seed: boolean;
  ashbyBoards: string[];
}

export interface CompanySourceProfile {
  companyName: string;
  companyWebsite: string;
  ats: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'other';
  boardIdentifier?: string;
  careersUrl?: string;
  country?: string;
  industries?: string[];
  remotePolicy?: string;
}

interface RequestCacheEntry<T> {
  expiresAt: number;
  value: T;
}

const requestCache = new Map<string, RequestCacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const entry = requestCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    requestCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs: number): void {
  requestCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}

function parseExperience(value: unknown): number {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const match = text.match(/(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/i) || text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeCountry(value?: string | null): string {
  const text = normalizeText(value);
  if (!text) return 'Remote';
  if (/india|indian/i.test(text)) return 'India';
  if (/united states|usa|us/i.test(text)) return 'United States';
  if (/uk|united kingdom|england|britain/i.test(text)) return 'United Kingdom';
  return text;
}

function normalizeIndustry(value?: string | null): string {
  const text = normalizeText(value);
  return text || 'General';
}

function normalizeEmploymentType(value?: string | null): Job['employmentType'] {
  const text = normalizeText(value).toLowerCase();
  if (/contract/i.test(text)) return 'Contract';
  if (/part[- ]?time|part time/i.test(text)) return 'Part-time';
  return 'Full-time';
}

function normalizeRemoteStatus(input?: string | boolean | null): Job['remoteStatus'] {
  if (typeof input === 'boolean') return input ? 'TRUE' : 'FALSE';

  const text = normalizeText(input).toLowerCase();
  if (!text) return 'UNKNOWN';
  if (/remote|distributed|work from anywhere|worldwide|virtual|anywhere/i.test(text)) return 'TRUE';
  if (/hybrid|onsite|in[- ]?office|office|on[- ]?site/i.test(text)) return 'FALSE';
  return 'UNKNOWN';
}

function normalizeSkills(raw: Array<string | undefined | null>): string[] {
  return unique(
    raw
      .filter(Boolean)
      .map((value) => normalizeText(value))
      .flatMap((value) => value.split(/[;,|]/).map((part) => part.trim()))
      .filter((value) => value.length > 1)
  );
}

function normalizeCurrency(value?: string | null): SalaryCurrency {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('inr')) return 'INR';
  if (text.includes('eur')) return 'EUR';
  if (text.includes('gbp') || text.includes('£')) return 'GBP';
  return 'USD';
}

function parseCompensation(input: unknown): { salaryMin: number | null; salaryMax: number | null; salaryCurrency: SalaryCurrency } {
  if (!input) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: 'USD' };
  }

  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const minValue = Number(record.min ?? record.minimum ?? record.salaryMin ?? record.lowest ?? 0);
    const maxValue = Number(record.max ?? record.maximum ?? record.salaryMax ?? record.highest ?? 0);
    const currency = normalizeCurrency(String(record.currency ?? record.currencyCode ?? 'USD'));

    if (Number.isFinite(minValue) && minValue > 0 && Number.isFinite(maxValue) && maxValue > 0) {
      return { salaryMin: minValue, salaryMax: maxValue, salaryCurrency: currency };
    }

    if (Number.isFinite(minValue) && minValue > 0) {
      return { salaryMin: minValue, salaryMax: null, salaryCurrency: currency };
    }
  }

  if (typeof input === 'string') {
    const text = normalizeText(input);
    if (!text) return { salaryMin: null, salaryMax: null, salaryCurrency: 'USD' };

    const matches = [...text.matchAll(/\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:-\s*\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)|to\s*\$?\s?(\d+(?:,\d{3})*(?:\.\d+)?)|k|K)?/g)];
    const values = matches
      .flatMap((match) => match.slice(1).filter(Boolean).map((value) => Number(String(value).replace(/[$,]/g, ''))))
      .filter((value) => Number.isFinite(value));

    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const multiplier = /k|K/.test(text) ? 1000 : 1;
      return {
        salaryMin: min * multiplier,
        salaryMax: max * multiplier,
        salaryCurrency: normalizeCurrency(text),
      };
    }
  }

  return { salaryMin: null, salaryMax: null, salaryCurrency: 'USD' };
}

function classifyIndiaEligibility(input?: boolean | string | null, location?: string | null, description?: string | null): { indiaEligible: boolean; indiaEligibilityStatus: Job['indiaEligibilityStatus'] } {
  const text = `${normalizeText(typeof input === 'string' ? input : '')} ${normalizeText(location)} ${normalizeText(description)}`.toLowerCase();

  if (typeof input === 'boolean') {
    return {
      indiaEligible: input,
      indiaEligibilityStatus: input ? 'YES' : 'NO',
    };
  }

  if (/india.*eligible|eligible.*india|hiring.*india|can.*apply.*india|india.*hire|remote.*india|open.*to.*india/i.test(text)) {
    return { indiaEligible: true, indiaEligibilityStatus: 'YES' };
  }

  if (/india.*not eligible|not eligible.*india|not.*hiring.*india|cannot.*apply.*india|india.*not.*eligible|not open.*india|india.*not.*accepted/i.test(text)) {
    return { indiaEligible: false, indiaEligibilityStatus: 'NO' };
  }

  return { indiaEligible: true, indiaEligibilityStatus: 'UNKNOWN' };
}

function makeJobId(sourceName: string, seed: string): string {
  return `${sourceName}-${seed}`.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

function buildCanonicalJob(input: {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  country?: string;
  remote?: boolean;
  remoteStatus?: Job['remoteStatus'];
  indiaEligible?: boolean | string | null;
  description?: string;
  applicationUrl?: string;
  source: string;
  postedDate?: string;
  companyWebsite?: string;
  careersUrl?: string;
  ats?: Job['ats'];
  remotePolicy?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: SalaryCurrency;
  industry?: string;
  requiredSkills?: Array<string | undefined | null>;
  requiredExperience?: number | null;
  employmentType?: string | null;
  isDemo?: boolean;
}): Job {
  const normalizedLocation = normalizeText(input.location) || 'Remote';
  const normalizedCountry = normalizeCountry(input.country || normalizedLocation);
  const remoteStatus = normalizeRemoteStatus(input.remoteStatus ?? (input.remote !== undefined ? input.remote : normalizedLocation));
  const isRemote = remoteStatus === 'TRUE' || /remote|distributed|virtual|work from anywhere|worldwide/i.test(normalizedLocation);
  const indiaClassification = classifyIndiaEligibility(input.indiaEligible, normalizedLocation, input.description);

  return {
    id: input.id ?? makeJobId(input.source, `${normalizeText(input.company)}-${normalizeText(input.title)}-${Date.now()}`),
    title: normalizeText(input.title) || 'Untitled role',
    company: normalizeText(input.company) || 'Unknown company',
    location: normalizedLocation,
    country: normalizedCountry,
    remote: isRemote,
    remoteStatus,
    indiaEligible: indiaClassification.indiaEligible,
    indiaEligibilityStatus: indiaClassification.indiaEligibilityStatus,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    salaryCurrency: input.salaryCurrency ?? 'USD',
    employmentType: normalizeEmploymentType(input.employmentType),
    industry: normalizeIndustry(input.industry),
    requiredSkills: normalizeSkills(input.requiredSkills ?? []),
    requiredExperience: input.requiredExperience ?? null,
    description: normalizeText(input.description) || 'No description provided.',
    applicationUrl: normalizeText(input.applicationUrl) || '#',
    source: input.source,
    postedDate: normalizeText(input.postedDate),
    companyWebsite: input.companyWebsite,
    careersUrl: input.careersUrl,
    ats: input.ats,
    remotePolicy: input.remotePolicy,
    freshnessScore: input.postedDate ? calculateFreshnessScore(input.postedDate) : 0,
    isDemo: Boolean(input.isDemo),
  };
}

function calculateFreshnessScore(postedDate: string): number {
  const timestamp = new Date(postedDate).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
  return ageDays <= 30 ? 100 : ageDays <= 90 ? 70 : 40;
}

export function dedupeJobs(jobs: Job[]): Job[] {
  const map = new Map<string, Job>();

  for (const job of jobs) {
    const source = normalizeText(job.source).toLowerCase();
    const company = normalizeText(job.company).toLowerCase();
    const title = normalizeText(job.title).toLowerCase();
    const location = normalizeText(job.location).toLowerCase();
    const sourceId = normalizeText(job.id).toLowerCase();
    const applicationUrl = normalizeText(job.applicationUrl).toLowerCase();

    const keys = [
      applicationUrl && applicationUrl !== '#' ? `url:${applicationUrl}` : null,
      source && sourceId ? `source:${source}:${sourceId}` : null,
      source && company && title && location ? `identity:${source}|${company}|${title}|${location}` : null,
    ].filter(Boolean) as string[];

    let chosenKey: string | null = null;
    for (const key of keys) {
      if (map.has(key)) {
        chosenKey = key;
        break;
      }
    }
    chosenKey ??= keys[0] ?? null;

    if (!chosenKey) {
      map.set(`fallback:${Math.random().toString(36).slice(2)}`, job);
      continue;
    }

    const existing = map.get(chosenKey);
    if (!existing) {
      map.set(chosenKey, job);
      continue;
    }

    const existingScore = [existing.description.length, existing.requiredSkills.length, existing.applicationUrl.length].reduce((sum, value) => sum + value, 0);
    const candidateScore = [job.description.length, job.requiredSkills.length, job.applicationUrl.length].reduce((sum, value) => sum + value, 0);
    if (candidateScore > existingScore) {
      map.set(chosenKey, job);
    }
  }

  return [...map.values()];
}

export function applyJobFilters(jobs: Job[], query: DiscoveryQuery): Job[] {
  const target = normalizeText(query.targetRole || query.targetJobTitle || '').toLowerCase();
  const minimumSalary = typeof query.minimumSalary === 'number' ? query.minimumSalary : 0;
  const country = normalizeText(query.country).toLowerCase();
  const experience = typeof query.experience === 'number' ? query.experience : Number(query.yearsOfExperience ?? 0);

  return jobs.filter((job) => {
    if (target) {
      const title = job.title.toLowerCase();
      const skillText = job.requiredSkills.join(' ').toLowerCase();
      const titleMatches = title.includes(target) || skillText.includes(target);
      const roleMatches = target.includes(title) || title.includes(target);
      if (!titleMatches && !roleMatches) {
        const targetWords = target.split(/\s+/).filter(Boolean);
        const titleWords = title.split(/\s+/);
        const broadMatch = targetWords.some((word) => titleWords.includes(word));
        if (!broadMatch) {
          return false;
        }
      }
    }

    if (query.remoteOnly && job.remoteStatus === 'FALSE') {
      return false;
    }

    if (query.indiaOnly && job.indiaEligibilityStatus === 'NO') {
      return false;
    }

    if (country && !job.country.toLowerCase().includes(country) && !(job.remote && country === 'india')) {
      return false;
    }

    if (minimumSalary > 0 && job.salaryMin !== null && job.salaryMin < minimumSalary) {
      return false;
    }

    if (experience > 0 && job.requiredExperience !== null && job.requiredExperience > experience + 2) {
      return false;
    }

    return true;
  });
}

const defaultGreenhouseBoards = ['stripe', 'github', 'notion', 'shopify', 'airtable', 'coinbase'];
const defaultLeverCompanies = ['posthog', 'notion', 'stripe', 'github', 'coinbase', 'airtable'];

const CACHE_TTL_MS = Number(process.env.JOB_CACHE_TTL_MS ?? '300000');

export function getSourceConfig(envSource: NodeJS.ProcessEnv = process.env): SourceConfig {
  const ashbyBoards = (envSource.ASHBY_JOB_BOARDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    greenhouse: envSource.GREENHOUSE_ENABLED !== 'false',
    lever: envSource.LEVER_ENABLED !== 'false',
    ashby: envSource.ASHBY_ENABLED !== 'false',
    remoteok: envSource.REMOTEOK_ENABLED !== 'false',
    remotive: envSource.REMOTIVE_ENABLED !== 'false',
    companyDiscovery: envSource.COMPANY_DISCOVERY_ENABLED !== 'false',
    seed: envSource.SEED_ENABLED !== 'false',
    ashbyBoards,
  };
}

export const defaultCompanyRegistry: CompanySourceProfile[] = verifiedCompanyRegistry;

export class SeedJobSource implements JobSource {
  name = 'seed';

  async fetchJobs(): Promise<Job[]> {
    return seedJobs.map((job) => ({
      ...job,
      source: 'seed',
      indiaEligibilityStatus: job.indiaEligibilityStatus || (job.indiaEligible ? 'YES' : 'UNKNOWN'),
      isDemo: true,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
    }));
  }
}

export class AshbyPublicJobBoardSource implements JobSource {
  name = 'ashby';

  constructor(private readonly boards: string[] = getSourceConfig().ashbyBoards) {}

  async fetchJobs(): Promise<Job[]> {
    const boardList = this.boards.length ? this.boards : getSourceConfig().ashbyBoards;
    if (boardList.length === 0) return [];

    const cacheKey = `ashby:${boardList.join(',')}`;
    const cached = readCache<Job[]>(cacheKey);
    if (cached) return cached;

    type AshbyPosting = {
      id?: string;
      title?: string;
      jobTitle?: string;
      company?: string | { name?: string };
      companyName?: string;
      brand?: string;
      location?: string;
      locations?: Array<{ city?: string; state?: string; country?: string; remote?: boolean; name?: string }>;
      description?: string;
      jobDescription?: string;
      team?: string;
      department?: string;
      employmentType?: string;
      isRemote?: boolean;
      remote?: boolean;
      applicationUrl?: string;
      applyUrl?: string;
      url?: string;
      postedAt?: string;
      datePosted?: string;
      createdAt?: string;
      compensation?: unknown;
      salaryMin?: number | null;
      salaryMax?: number | null;
      salaryCurrency?: string;
      tags?: string[];
      secondaryLocations?: string[];
    };

    const responses = await Promise.allSettled(
      boardList.map(async (board) => {
        const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`, { next: { revalidate: 300 } });
        if (!response.ok) return [];

        const data = await response.json();
        const jobs = Array.isArray(data) ? (data as AshbyPosting[]) : Array.isArray((data as { jobs?: AshbyPosting[] }).jobs) ? ((data as { jobs?: AshbyPosting[] }).jobs as AshbyPosting[]) : [];

        return jobs.map((job) => {
          const rawTitle = job.title || job.jobTitle || 'Role';
          const rawLocation = job.location || job.locations?.[0]?.city || job.locations?.[0]?.name || 'Remote';
          const compensation = parseCompensation(job.compensation ?? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency });
          const remoteStatus = normalizeRemoteStatus(job.remote ?? job.isRemote ?? rawLocation ?? 'Remote');
          const description = job.description || job.jobDescription || 'No description provided.';
          const normalizedCompany = typeof job.company === 'object' ? (job.company as { name?: string }).name : (job.companyName || job.brand || 'Unknown company');
          const indiaClassification = classifyIndiaEligibility(undefined, rawLocation, description);

          return buildCanonicalJob({
            id: `ashby-${board}-${String(job.id || rawTitle).replace(/\s+/g, '-').toLowerCase()}`,
            title: rawTitle,
            company: normalizedCompany,
            location: rawLocation,
            country: normalizeCountry(rawLocation),
            remote: remoteStatus === 'TRUE' || /remote|distributed|virtual|worldwide|anywhere/i.test(rawLocation),
            remoteStatus,
            indiaEligible: indiaClassification.indiaEligible,
            description,
            applicationUrl: job.applicationUrl || job.applyUrl || job.url || '#',
            source: this.name,
            postedDate: job.postedAt || job.datePosted || job.createdAt || new Date().toISOString(),
            salaryMin: compensation.salaryMin,
            salaryMax: compensation.salaryMax,
            salaryCurrency: compensation.salaryCurrency,
            industry: (job.team || job.department || 'General').replace(/[_-]+/g, ' '),
            requiredSkills: normalizeSkills([job.department, job.team, ...(job.tags || [])]),
            requiredExperience: parseExperience(description),
            employmentType: normalizeEmploymentType(job.employmentType || 'Full-time'),
            isDemo: false,
          });
        });
      })
    );

    const jobs = dedupeJobs(responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
    writeCache(cacheKey, jobs, CACHE_TTL_MS);
    return jobs;
  }
}

export class GreenhouseJobSource implements JobSource {
  name = 'greenhouse';

  constructor(private readonly boards: string[] = defaultGreenhouseBoards) {}

  async fetchJobs(): Promise<Job[]> {
    const cacheKey = `greenhouse:${this.boards.join(',')}`;
    const cached = readCache<Job[]>(cacheKey);
    if (cached) return cached;

    type GreenhouseJob = {
      id: string | number;
      title?: string;
      company_name?: string;
      company?: string;
      location?: string;
      offices?: Array<{ location?: string }>;
      content?: string;
      description?: string;
      absolute_url?: string;
      updated_at?: string;
      metadata?: Array<{ value?: string }>;
      departments?: Array<{ name?: string }>;
    };

    const responses = await Promise.allSettled(
      this.boards.map(async (board) => {
        const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { next: { revalidate: 300 } });
        if (!response.ok) return [];
        const data = await response.json();
        const jobs = Array.isArray(data.jobs) ? (data.jobs as GreenhouseJob[]) : [];

        return jobs.map((job) =>
          buildCanonicalJob({
            id: `greenhouse-${String(job.id)}`,
            title: job.title,
            company: job.company_name || job.company || board,
            location: job.location || job.offices?.[0]?.location || 'Remote',
            country: job.location || job.offices?.[0]?.location || 'Remote',
            remote: /remote|distributed|virtual/i.test(job.location || job.offices?.[0]?.location || 'Remote'),
            indiaEligible: /india/i.test(job.location || job.offices?.[0]?.location || job.content || ''),
            description: job.content || job.description || 'No description provided.',
            applicationUrl: job.absolute_url || `https://boards.greenhouse.io/${board}/jobs/${job.id}`,
            source: this.name,
            postedDate: job.updated_at || new Date().toISOString(),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: 'USD',
            industry: 'Technology',
            requiredSkills: [
              ...(job.metadata || []).map((item) => item.value).filter(Boolean),
              ...(job.departments || []).map((item) => item.name).filter(Boolean),
            ],
            requiredExperience: parseExperience(job.content || job.title || ''),
            employmentType: 'Full-time',
            isDemo: false,
          })
        );
      })
    );

    const jobs = dedupeJobs(responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
    writeCache(cacheKey, jobs, CACHE_TTL_MS);
    return jobs;
  }
}

export class LeverJobSource implements JobSource {
  name = 'lever';

  constructor(private readonly companies: string[] = defaultLeverCompanies) {}

  async fetchJobs(): Promise<Job[]> {
    const cacheKey = `lever:${this.companies.join(',')}`;
    const cached = readCache<Job[]>(cacheKey);
    if (cached) return cached;

    type LeverJob = {
      id: string;
      text?: string;
      title?: string;
      company?: string;
      categories?: {
        location?: string;
        team?: string;
        role?: string;
        commitment?: string;
      };
      workplace?: string;
      description?: string;
      descriptionPlain?: string;
      hostedUrl?: string;
      applyUrl?: string;
      createdAt?: string;
    };

    const responses = await Promise.allSettled(
      this.companies.map(async (company) => {
        const response = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, { next: { revalidate: 300 } });
        if (!response.ok) return [];
        const data = await response.json();
        const jobs = Array.isArray(data) ? (data as LeverJob[]) : [];

        return jobs.map((job) =>
          buildCanonicalJob({
            id: `lever-${job.id}`,
            title: job.text || job.title,
            company: job.company || company,
            location: job.categories?.location || job.workplace || 'Remote',
            country: job.categories?.location || job.workplace || 'Remote',
            remote: /remote|distributed|virtual/i.test(job.categories?.location || job.workplace || 'Remote'),
            indiaEligible: /india/i.test(job.categories?.location || job.description || ''),
            description: job.description || job.descriptionPlain || 'No description provided.',
            applicationUrl: job.hostedUrl || job.applyUrl || `https://jobs.lever.co/${company}/${job.id}`,
            source: this.name,
            postedDate: job.createdAt || new Date().toISOString(),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: 'USD',
            industry: job.categories?.team || 'Technology',
            requiredSkills: normalizeSkills([job.categories?.role, job.categories?.commitment]),
            requiredExperience: parseExperience(job.description || job.text || ''),
            employmentType: normalizeEmploymentType(job.categories?.commitment || job.workplace),
            isDemo: false,
          })
        );
      })
    );

    const jobs = dedupeJobs(responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
    writeCache(cacheKey, jobs, CACHE_TTL_MS);
    return jobs;
  }
}

export class RemoteOKJobSource implements JobSource {
  name = 'remoteok';

  async fetchJobs(): Promise<Job[]> {
    const cacheKey = 'remoteok';
    const cached = readCache<Job[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch('https://remoteok.com/api', { next: { revalidate: 300 } });
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    type RemoteOKJob = {
      id?: string | number;
      slug?: string;
      position?: string;
      company?: string;
      location?: string;
      description?: string;
      url?: string;
      apply_url?: string;
      date?: string;
      tags?: string[];
    };

    const jobs = Array.isArray(data) ? (data as RemoteOKJob[]) : [];
    const normalized = jobs
      .filter((job) => job && job.company && job.position)
      .map((job) =>
        buildCanonicalJob({
          id: `remoteok-${String(job.id || job.slug || job.position)}`,
          title: job.position,
          company: job.company,
          location: job.location || 'Remote',
          country: 'United States',
          remote: true,
          indiaEligible: /india/i.test(`${job.location || ''} ${job.description || ''}`),
          description: job.description || 'No description provided.',
          applicationUrl: job.url || job.apply_url || `https://remoteok.com/remote-jobs/${job.slug || job.id}`,
          source: this.name,
          postedDate: job.date || new Date().toISOString(),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: 'USD',
          industry: job.tags?.[0] || 'Technology',
          requiredSkills: normalizeSkills(job.tags || []),
          requiredExperience: parseExperience(job.description || job.position || ''),
          employmentType: 'Full-time',
          isDemo: false,
        })
      );

    const deduped = dedupeJobs(normalized);
    writeCache(cacheKey, deduped, CACHE_TTL_MS);
    return deduped;
  }
}

export class RemotiveJobSource implements JobSource {
  name = 'remotive';

  async fetchJobs(): Promise<Job[]> {
    const cacheKey = 'remotive';
    const cached = readCache<Job[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch('https://remotive.com/api/remote-jobs?limit=100', { next: { revalidate: 300 } });
    if (!response.ok) {
      return [];
    }

    type RemotiveJob = {
      id?: string | number;
      title?: string;
      company_name?: string;
      company?: string;
      candidate_required_location?: string;
      description?: string;
      url?: string;
      publication_date?: string;
      category?: string;
      tags?: string[];
      job_type?: string;
    };

    const data = await response.json();
    const jobs = Array.isArray(data.jobs) ? (data.jobs as RemotiveJob[]) : [];
    const normalized = jobs.map((job) =>
      buildCanonicalJob({
        id: `remotive-${String(job.id)}`,
        title: job.title,
        company: job.company_name || job.company || 'Unknown company',
        location: job.candidate_required_location || 'Remote',
        country: job.candidate_required_location || 'Remote',
        remote: true,
        indiaEligible: /india/i.test(`${job.candidate_required_location || ''} ${job.description || ''}`),
        description: job.description || 'No description provided.',
        applicationUrl: job.url || '#',
        source: this.name,
        postedDate: job.publication_date || new Date().toISOString(),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: 'USD',
        industry: job.category || 'Technology',
        requiredSkills: normalizeSkills([job.category, ...(job.tags || [])]),
        requiredExperience: parseExperience(job.description || job.title || ''),
        employmentType: normalizeEmploymentType(job.job_type || 'Full-time'),
        isDemo: false,
      })
    );

    const deduped = dedupeJobs(normalized);
    writeCache(cacheKey, deduped, CACHE_TTL_MS);
    return deduped;
  }
}

const COMPANY_FETCH_CONCURRENCY = 4;
const COMPANY_REQUEST_TIMEOUT_MS = 10000;

function isValidApplicationUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPANY_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class CompanyDiscoverySource implements JobSourceWithMetrics {
  name = 'companyDiscovery';
  lastMetrics: CompanyDiscoveryMetrics = {
    companiesConfigured: 0,
    companiesQueried: 0,
    companiesSucceeded: 0,
    companiesFailed: 0,
    jobsFetched: 0,
    jobsNormalized: 0,
    jobsRejected: 0,
  };

  constructor(private readonly companies: CompanySourceProfile[] = verifiedCompanyRegistry) {}

  async fetchJobs(): Promise<Job[]> {
    const result = await this.fetchJobsWithMetrics();
    return result.jobs;
  }

  async fetchJobsWithMetrics(): Promise<{ jobs: Job[]; metrics: CompanyDiscoveryMetrics }> {
    const jobs: Job[] = [];
    let companiesSucceeded = 0;
    let companiesFailed = 0;
    let jobsFetched = 0;
    let jobsNormalized = 0;
    let jobsRejected = 0;

    for (let index = 0; index < this.companies.length; index += COMPANY_FETCH_CONCURRENCY) {
      const batch = this.companies.slice(index, index + COMPANY_FETCH_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((company) => this.fetchCompany(company)));
      results.forEach((result) => {
        if (result.status === 'rejected') {
          companiesFailed += 1;
          return;
        }
        companiesSucceeded += 1;
        jobsFetched += result.value.fetched;
        jobsNormalized += result.value.normalized.length;
        jobsRejected += result.value.rejected;
        jobs.push(...result.value.normalized);
      });
    }

    this.lastMetrics = {
      companiesConfigured: this.companies.length,
      companiesQueried: this.companies.length,
      companiesSucceeded,
      companiesFailed,
      jobsFetched,
      jobsNormalized,
      jobsRejected,
    };

    return { jobs: dedupeJobs(jobs), metrics: this.lastMetrics };
  }

  private async fetchCompany(company: CompanySourceProfile): Promise<{ fetched: number; normalized: Job[]; rejected: number }> {
    if (company.ats !== 'greenhouse' || !company.boardIdentifier) {
      throw new Error(`Unsupported or incomplete company source: ${company.companyName}`);
    }

    const response = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.boardIdentifier)}/jobs?content=true`);
    if (!response.ok) throw new Error(`Company board returned ${response.status}`);

    const data = await response.json() as { jobs?: Array<Record<string, unknown>> };
    const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];
    const normalized: Job[] = [];
    let rejected = 0;

    rawJobs.forEach((rawJob) => {
      const title = typeof rawJob.title === 'string' ? rawJob.title : '';
      const applicationUrl = typeof rawJob.absolute_url === 'string' ? rawJob.absolute_url : '';
      if (!title || !isValidApplicationUrl(applicationUrl)) {
        rejected += 1;
        return;
      }

      const locationRecord = rawJob.location && typeof rawJob.location === 'object' ? rawJob.location as Record<string, unknown> : null;
      const location = typeof rawJob.location === 'string'
        ? rawJob.location
        : typeof locationRecord?.name === 'string' ? locationRecord.name : 'Unknown';
      const description = typeof rawJob.content === 'string' ? rawJob.content : typeof rawJob.description === 'string' ? rawJob.description : '';
      const indiaClassification = classifyIndiaEligibility(undefined, location, `${description} ${company.remotePolicy || ''}`);
      const departments = Array.isArray(rawJob.departments)
        ? rawJob.departments.flatMap((department) => department && typeof department === 'object' && typeof (department as Record<string, unknown>).name === 'string' ? [(department as Record<string, unknown>).name as string] : [])
        : [];
      const metadata = Array.isArray(rawJob.metadata)
        ? rawJob.metadata.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).value === 'string' ? [(item as Record<string, unknown>).value as string] : [])
        : [];

      normalized.push(buildCanonicalJob({
        id: `company-${company.boardIdentifier}-${String(rawJob.id || title).replace(/\s+/g, '-').toLowerCase()}`,
        title,
        company: company.companyName,
        location,
        country: location,
        remote: /remote|distributed|virtual|work from anywhere|worldwide/i.test(location),
        remoteStatus: normalizeRemoteStatus(location),
        indiaEligible: indiaClassification.indiaEligibilityStatus,
        description,
        applicationUrl,
        source: this.name,
        postedDate: typeof rawJob.updated_at === 'string' ? rawJob.updated_at : undefined,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: 'USD',
        industry: company.industries?.[0] || 'General',
        requiredSkills: [...departments, ...metadata],
        requiredExperience: parseExperience(description),
        employmentType: 'Full-time',
        companyWebsite: company.companyWebsite,
        careersUrl: company.careersUrl,
        ats: company.ats,
        remotePolicy: company.remotePolicy,
        isDemo: false,
      }));
    });

    return { fetched: rawJobs.length, normalized, rejected };
  }
}

export interface SourceRegistryOptions {
  enabledSources?: string[];
  config?: Partial<SourceConfig>;
}

export function createJobSourceRegistry(options: SourceRegistryOptions = {}): {
  fetchJobs: (query: DiscoveryQuery) => Promise<Job[]>;
  fetchJobsWithMetrics: (query: DiscoveryQuery) => Promise<{ jobs: Job[]; metrics: Record<string, number | string | Record<string, number>>; diagnostics: Array<{ source: string; fetched: number; normalized: number; rejected: number; duplicate: number; filtered: number; ranked: number }> }>;
  sources: JobSource[];
} {
  const baseConfig = getSourceConfig();
  const config: SourceConfig = {
    ...baseConfig,
    ...options.config,
    ashbyBoards: options.config?.ashbyBoards ?? baseConfig.ashbyBoards,
  };

  const liveAllowedSources = ['greenhouse', 'lever', 'ashby', 'remoteok', 'remotive', 'companyDiscovery'];
  const defaultEnabled = options.enabledSources?.length
    ? options.enabledSources
    : Object.entries(config)
        .filter(([key, value]) => key !== 'ashbyBoards' && value && liveAllowedSources.includes(key))
        .map(([key]) => key);

  const sources: JobSource[] = [
    new GreenhouseJobSource(),
    new LeverJobSource(),
    new AshbyPublicJobBoardSource(config.ashbyBoards),
    new RemoteOKJobSource(),
    new RemotiveJobSource(),
    new CompanyDiscoverySource(),
    new SeedJobSource(),
  ].filter((source) => defaultEnabled.includes(source.name));

  return {
    sources,
    async fetchJobs(query: DiscoveryQuery): Promise<Job[]> {
      const { jobs } = await this.fetchJobsWithMetrics(query);
      return jobs;
    },
    async fetchJobsWithMetrics(query: DiscoveryQuery): Promise<{ jobs: Job[]; metrics: Record<string, number | string | Record<string, number>>; diagnostics: Array<{ source: string; fetched: number; normalized: number; rejected: number; duplicate: number; filtered: number; ranked: number }> }> {
      const sourceResults = await Promise.allSettled(
        sources.map(async (source) => {
          const result = 'fetchJobsWithMetrics' in source
            ? await (source as JobSourceWithMetrics).fetchJobsWithMetrics(query)
            : { jobs: await source.fetchJobs(query), metrics: undefined };
          const fetched = result.jobs;
          return {
            source: source.name,
            fetched: fetched.length,
            normalized: fetched.length,
            rejected: 0,
            duplicate: 0,
            filtered: 0,
            ranked: 0,
            jobs: fetched,
            sourceMetrics: result.metrics,
          };
        })
      );

      const providerEntries = sourceResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const flattened = providerEntries.flatMap((entry) => entry.jobs);
      const deduped = dedupeJobs(flattened);
      const filtered = applyJobFilters(deduped, query);

      const sourceCounts: Record<string, number> = {};
      for (const source of sources) {
        sourceCounts[source.name] = providerEntries.find((entry) => entry.source === source.name)?.fetched ?? 0;
      }

      const metrics = {
        totalCollected: flattened.length,
        totalAfterDeduplication: deduped.length,
        totalEligible: filtered.length,
        totalRanked: filtered.length,
        totalRemaining: filtered.length,
        duplicates: Math.max(0, flattened.length - deduped.length),
        malformed: 0,
        salaryKnown: filtered.filter((job) => job.salaryMin !== null).length,
        indiaEligible: filtered.filter((job) => job.indiaEligibilityStatus === 'YES').length,
        indiaUnknown: filtered.filter((job) => job.indiaEligibilityStatus === 'UNKNOWN').length,
        indiaExplicitNo: filtered.filter((job) => job.indiaEligibilityStatus === 'NO').length,
        sources: sourceCounts,
      };

      const companyEntry = providerEntries.find((entry) => entry.source === 'companyDiscovery');
      if (companyEntry?.sourceMetrics) {
        Object.assign(metrics, companyEntry.sourceMetrics);
      }

      return {
        jobs: filtered,
        metrics,
        diagnostics: providerEntries.map((entry) => ({
          source: entry.source,
          fetched: entry.fetched,
          normalized: entry.normalized,
          rejected: entry.rejected,
          duplicate: 0,
          filtered: 0,
          ranked: entry.jobs.length,
        })),
      };
    },
  };
}

export function buildExpandedRoleQueries(profile: Partial<CandidateProfile> & { targetJobTitle?: string; targetRole?: string }): string[] {
  const baseTitle = normalizeText(profile.targetRole || profile.targetJobTitle || '').trim();
  const titleVariants = new Set<string>();

  if (!baseTitle) return [];

  const normalized = baseTitle.toLowerCase();
  const titleMap: Record<string, string[]> = {
    'finance manager': ['Finance Manager', 'Senior Finance Manager', 'Finance & Accounting Manager', 'Accounting Manager', 'Finance Lead', 'Accounting Lead', 'Financial Controller', 'Assistant Financial Controller', 'FP&A Manager', 'Finance Business Partner', 'Senior Finance Business Partner', 'Commercial Finance Manager', 'Management Accountant', 'Senior Accountant', 'Financial Reporting Manager', 'Regional Finance Manager'],
    'accounting manager': ['Accounting Manager', 'Finance Manager', 'Senior Accountant', 'Financial Controller', 'Accounting Lead', 'Management Accountant', 'Finance & Accounting Manager'],
    'financial controller': ['Financial Controller', 'Assistant Financial Controller', 'Finance Manager', 'Accounting Manager', 'Senior Finance Manager', 'Finance Lead'],
    'business analyst': ['Business Analyst', 'Senior Business Analyst', 'Product Analyst', 'Data Analyst', 'Operations Analyst', 'Business Systems Analyst'],
    'product manager': ['Product Manager', 'Senior Product Manager', 'Associate Product Manager', 'Product Lead', 'Growth Product Manager'],
    'data analyst': ['Data Analyst', 'Senior Data Analyst', 'Analytics Manager', 'BI Analyst', 'Data Manager', 'Reporting Analyst'],
    'software engineer': ['Software Engineer', 'Senior Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer', 'Platform Engineer'],
    'hr business partner': ['HR Business Partner', 'Senior HR Business Partner', 'People Business Partner', 'Talent Partner', 'HRBP'],
  };

  for (const [key, variants] of Object.entries(titleMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      variants.forEach((variant) => titleVariants.add(variant));
    }
  }

  titleVariants.add(baseTitle);
  titleVariants.add(`${baseTitle} Manager`);
  titleVariants.add(`Senior ${baseTitle}`);
  titleVariants.add(`${baseTitle} Lead`);

  if (!normalized.includes('manager') && !normalized.includes('lead')) {
    titleVariants.add(`${baseTitle} Manager`);
  }

  const ordered = Array.from(titleVariants)
    .filter((value) => value && value.trim().length > 0)
    .slice(0, 12);

  return ordered;
}

export function getDefaultJobSources(): JobSource[] {
  return [
    new GreenhouseJobSource(),
    new LeverJobSource(),
    new RemoteOKJobSource(),
    new RemotiveJobSource(),
    new CompanyDiscoverySource(),
  ];
}
