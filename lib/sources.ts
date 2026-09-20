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
};

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchGreenhouseBoard(board: string): Promise<Job[]> {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`, { next: { revalidate: 900 } });
  if (!response.ok) return [];
  const data = (await response.json()) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).map((job) => {
    const text = stripHtml(job.content);
    const location = job.location?.name ?? "Location not disclosed";
    const remote = /remote/i.test(location + " " + text);
    const indiaEligible = /india|global|anywhere|remote/i.test(location + " " + text);
    return {
      id: `greenhouse-${board}-${job.id}`,
      title: job.title,
      company: board,
      location,
      remote,
      indiaEligible,
      source: "Greenhouse",
      url: job.absolute_url,
      posted: job.updated_at ?? "Recently updated",
      description: text.slice(0, 900),
      skills: [],
    };
  });
}

export async function fetchAshbyBoard(board: string): Promise<Job[]> {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`, { next: { revalidate: 900 } });
  if (!response.ok) return [];
  const data = (await response.json()) as { jobs?: AshbyJob[] };
  return (data.jobs ?? []).map((job) => {
    const location = job.location ?? "Location not disclosed";
    const remote = Boolean(job.isRemote) || /remote/i.test(location);
    const indiaEligible = /india|global|anywhere|remote/i.test(location + " " + (job.descriptionPlain ?? ""));
    return {
      id: `ashby-${board}-${job.id}`,
      title: job.title,
      company: board,
      location,
      remote,
      indiaEligible,
      source: "Ashby",
      url: job.jobUrl,
      posted: job.publishedAt ?? "Recently listed",
      description: (job.descriptionPlain ?? "").slice(0, 900),
      skills: [],
    };
  });
}

export async function discoverJobs() {
  const greenhouse = (process.env.GREENHOUSE_BOARDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const ashby = (process.env.ASHBY_BOARDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const [g, a] = await Promise.all([
    Promise.all(greenhouse.map(fetchGreenhouseBoard)),
    Promise.all(ashby.map(fetchAshbyBoard)),
  ]);
  return [...g.flat(), ...a.flat()];
}
