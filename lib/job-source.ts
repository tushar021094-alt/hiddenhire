import type { CandidateProfile, Job, SalaryCurrency } from './job-types';
import { seedJobs } from './job-data';

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
    postedDate: normalizeText(input.postedDate) || new Date().toISOString(),
    isDemo: Boolean(input.isDemo),
  };
}

function dedupeJobs(jobs: Job[]): Job[] {
  const map = new Map<string, Job>();

  for (const job of jobs) {
    const key = [
      job.company.toLowerCase(),
      job.title.toLowerCase(),
      job.applicationUrl.toLowerCase(),
    ].join('|');

    const existing = map.get(key);
    if (!existing) {
      map.set(key, job);
      continue;
    }

    const existingScore = [existing.description.length, existing.requiredSkills.length, existing.applicationUrl.length].reduce((sum, value) => sum + value, 0);
    const candidateScore = [job.description.length, job.requiredSkills.length, job.applicationUrl.length].reduce((sum, value) => sum + value, 0);
    if (candidateScore > existingScore) {
      map.set(key, job);
    }
  }

  return [...map.values()];
}

function applyJobFilters(jobs: Job[], query: DiscoveryQuery): Job[] {
  const target = normalizeText(query.targetRole || query.targetJobTitle || '').toLowerCase();
  const minimumSalary = typeof query.minimumSalary === 'number' ? query.minimumSalary : 0;
  const country = normalizeText(query.country).toLowerCase();
  const industry = normalizeText(query.industry).toLowerCase();
  const experience = typeof query.experience === 'number' ? query.experience : Number(query.yearsOfExperience ?? 0);

  return jobs.filter((job) => {
    if (target) {
      const titleMatches = job.title.toLowerCase().includes(target) || job.requiredSkills.some((skill) => skill.toLowerCase().includes(target));
      const roleMatches = target.includes(job.title.toLowerCase()) || job.title.toLowerCase().includes(target);
      if (!titleMatches && !roleMatches) {
        const targetWords = target.split(/\s+/).filter(Boolean);
        const titleWords = job.title.toLowerCase().split(/\s+/);
        const broadMatch = targetWords.some((word) => titleWords.includes(word));
        if (!broadMatch) {
          return false;
        }
      }
    }

    if (minimumSalary > 0 && (job.salaryMin === null || job.salaryMin < minimumSalary)) {
      return false;
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

    if (industry && !job.industry.toLowerCase().includes(industry)) {
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

export class SeedJobSource implements JobSource {
  name = 'seed';

  async fetchJobs(): Promise<Job[]> {
    return seedJobs.map((job) => ({
      ...job,
      indiaEligibilityStatus: job.indiaEligibilityStatus || (job.indiaEligible ? 'YES' : 'UNKNOWN'),
      isDemo: true,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
    }));
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

export interface SourceRegistryOptions {
  enabledSources?: string[];
}

export function createJobSourceRegistry(options: SourceRegistryOptions = {}): { fetchJobs: (query: DiscoveryQuery) => Promise<Job[]>; sources: JobSource[] } {
  const enabledSources = options.enabledSources?.length ? options.enabledSources : ['greenhouse', 'lever', 'remoteok', 'remotive', 'seed'];

  const sources: JobSource[] = [
    new GreenhouseJobSource(),
    new LeverJobSource(),
    new RemoteOKJobSource(),
    new RemotiveJobSource(),
    new SeedJobSource(),
  ].filter((source) => enabledSources.includes(source.name));

  return {
    sources,
    async fetchJobs(query: DiscoveryQuery): Promise<Job[]> {
      const jobs = await Promise.allSettled(
        sources.map(async (source) => source.fetchJobs(query))
      );

      const flattened = jobs.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
      const deduped = dedupeJobs(flattened);
      const filtered = applyJobFilters(deduped, query);

      if (filtered.length > 0) {
        return filtered;
      }

      const seedFallback = await new SeedJobSource().fetchJobs();
      return applyJobFilters(seedFallback, query);
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
    new SeedJobSource(),
  ];
}
