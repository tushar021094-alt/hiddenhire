import type { Job } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url: string;
  updated_at?: string;
  content?: string;
  departments?: { name?: string }[];
};

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  isRemote?: boolean;
  workplaceType?: string;
};

const DEFAULT_GREENHOUSE_BOARDS = [
  "coinbase", "okta", "samsara", "twilio", "stripe",
  "doordash", "hubspot", "brex", "rippling", "cloudflare",
];

const DEFAULT_ASHBY_BOARDS = [
  "notion", "ramp", "deel", "remote", "vercel", "linear",
];

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseSalary(text: string) {
  const normalized = text.replace(/,/g, "");
  const matches = [...normalized.matchAll(/(?:\$|USD\s*)(\d{2,3})(?:k)?(?:\s*(?:-|–|to)\s*(?:\$|USD\s*)?(\d{2,3}))?\s*(k)?/gi)];
  for (const match of matches) {
    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : undefined;
    const multiplier = match[3] || /\bk\b/i.test(match[0]) ? 1000 : 1;
    const min = first < 1000 ? first * 1000 : first;
    const max = second ? (second < 1000 ? second * 1000 : second) : undefined;
    if (min >= 20000 && min <= 1000000) return { salaryMin: min * (multiplier === 1000 && first >= 1000 ? 1 : 1), salaryMax: max };
  }
  return {};
}

function indiaEligibility(location: string, description: string, remote: boolean) {
  const text = `${location} ${description}`.toLowerCase();
  const explicitIndia = /\bindia\b|\bindian\b|\bbengaluru\b|\bbangalore\b|\bdelhi\b|\bmumbai\b|\bhyderabad\b|\bpune\b|\bnoida\b|\bgurgaon\b|\bgurugram\b/.test(text);
  const explicitRestriction = /us only|u\.s\. only|united states only|europe only|uk only|canada only|americas only/.test(text);
  const globalRemote = /work from anywhere|anywhere in the world|global remote|worldwide|international remote/.test(text);
  return !explicitRestriction && (explicitIndia || globalRemote || (remote && /india|apac|asia/i.test(text)));
}

function normalizeCompany(board: string) {
  return board
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchGreenhouseBoard(board: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { jobs?: GreenhouseJob[] };
    return (data.jobs ?? []).map((job) => {
      const text = stripHtml(job.content);
      const location = job.location?.name ?? "Location not disclosed";
      const remote = /remote/i.test(location + " " + text);
      const eligibility = indiaEligibility(location, text, remote);
      return {
        id: `greenhouse-${board}-${job.id}`,
        title: job.title,
        company: normalizeCompany(board),
        location,
        remote,
        indiaEligible: eligibility,
        source: "Greenhouse",
        url: job.absolute_url,
        posted: job.updated_at ?? "Recently updated",
        description: text.slice(0, 900),
        skills: [],
        ...parseSalary(text),
      };
    });
  } catch {
    return [];
  }
}

export async function fetchAshbyBoard(board: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { jobs?: AshbyJob[] };
    return (data.jobs ?? []).map((job) => {
      const location = job.location ?? "Location not disclosed";
      const remote = Boolean(job.isRemote) || /remote/i.test(location + " " + (job.workplaceType ?? ""));
      const description = job.descriptionPlain ?? "";
      return {
        id: `ashby-${board}-${job.id}`,
        title: job.title,
        company: normalizeCompany(board),
        location,
        remote,
        indiaEligible: indiaEligibility(location, description, remote),
        source: "Ashby",
        url: job.jobUrl,
        posted: job.publishedAt ?? "Recently listed",
        description: description.slice(0, 900),
        skills: [],
        ...parseSalary(description),
      };
    });
  } catch {
    return [];
  }
}

export async function discoverJobs() {
  const greenhouse = (process.env.GREENHOUSE_BOARDS ?? DEFAULT_GREENHOUSE_BOARDS.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const ashby = (process.env.ASHBY_BOARDS ?? DEFAULT_ASHBY_BOARDS.join(",")).split(",").map(s => s.trim()).filter(Boolean);

  const [g, a] = await Promise.all([
    Promise.all(greenhouse.map(fetchGreenhouseBoard)),
    Promise.all(ashby.map(fetchAshbyBoard)),
  ]);

  const jobs = [...g.flat(), ...a.flat()];
  const unique = new Map<string, Job>();
  for (const job of jobs) {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.location.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, job);
  }
  return [...unique.values()];
}
