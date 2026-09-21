import { parseConfiguredSources, type SourceProvider } from "./source-registry";
import { fetchWorkdayBoard } from "./workday";

export type SourceHealthStatus = "healthy" | "empty" | "failing";

export type SourceHealth = {
  provider: SourceProvider;
  identifier: string;
  status: SourceHealthStatus;
  jobCount: number;
  responseMs: number;
  checkedAt: string;
  httpStatus?: number;
  error?: string;
};

const SOURCE_TIMEOUT_MS = 8000;

function endpoint(provider: Exclude<SourceProvider, "workday">, identifier: string) {
  const encoded = encodeURIComponent(identifier);
  switch (provider) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${encoded}/jobs?content=false`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${encoded}`;
    case "lever":
      return `https://api.lever.co/v0/postings/${encoded}?mode=json`;
    case "workable":
      return `https://www.workable.com/api/accounts/${encoded}?details=true`;
  }
}

function countJobs(provider: Exclude<SourceProvider, "workday">, payload: unknown) {
  if (provider === "lever") return Array.isArray(payload) ? payload.length : 0;
  if (!payload || typeof payload !== "object") return 0;
  const jobs = (payload as { jobs?: unknown }).jobs;
  return Array.isArray(jobs) ? jobs.length : 0;
}

function parseWorkdayCount(identifier: string) {
  return fetchWorkdayBoard(identifier);
}

async function checkSource(provider: SourceProvider, identifier: string): Promise<SourceHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    if (provider === "workday") {
      const jobs = await Promise.race([
        parseWorkdayCount(identifier),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Workday source timeout")), SOURCE_TIMEOUT_MS)),
      ]);
      const jobCount = jobs.length;
      return {
        provider, identifier, status: jobCount > 0 ? "healthy" : "empty",
        jobCount, responseMs: Date.now() - started, checkedAt, httpStatus: 200,
      };
    }

    const response = await fetch(endpoint(provider, identifier), {
      headers: { "user-agent": "HiddenHireSourceHealth/2.0", accept: "application/json" },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        provider, identifier, status: "failing", jobCount: 0,
        responseMs: Date.now() - started, checkedAt, httpStatus: response.status,
        error: `HTTP ${response.status}`,
      };
    }
    const payload = await response.json();
    const jobCount = countJobs(provider, payload);
    return {
      provider, identifier, status: jobCount > 0 ? "healthy" : "empty",
      jobCount, responseMs: Date.now() - started, checkedAt, httpStatus: response.status,
    };
  } catch (error) {
    return {
      provider, identifier, status: "failing", jobCount: 0,
      responseMs: Date.now() - started, checkedAt,
      error: error instanceof Error ? error.message : "Unknown source error",
    };
  }
}

type IndexedSource = {
  provider: SourceProvider;
  identifier: string | null;
  status: string;
};

async function indexedSources(): Promise<IndexedSource[]> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  const response = await fetch(
    `${base}/rest/v1/company_sources?status=eq.active&select=provider,identifier&order=updated_at.desc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}`, accept: "application/json" },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Supabase source lookup failed (HTTP ${response.status})`);
  return (await response.json()) as IndexedSource[];
}

export async function checkRegisteredSources(): Promise<SourceHealth[]> {
  const configured = ([
    "greenhouse", "ashby", "lever", "workable", "workday",
  ] as SourceProvider[]).flatMap(provider => {
    const envKey = {
      greenhouse: "GREENHOUSE_BOARDS",
      ashby: "ASHBY_BOARDS",
      lever: "LEVER_BOARDS",
      workable: "WORKABLE_SUBDOMAINS",
      workday: "WORKDAY_SOURCES",
    }[provider] as keyof NodeJS.ProcessEnv;
    return parseConfiguredSources(provider, process.env[envKey]);
  });

  const indexed = await indexedSources();
  const discovered = indexed
    .filter(source => source.identifier)
    .map(source => ({ provider: source.provider, identifier: source.identifier! }));

  const seen = new Set<string>();
  const sources = [...configured, ...discovered].filter(source => {
    const key = `${source.provider}:${source.identifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return Promise.all(sources.map(source => checkSource(source.provider, source.identifier)));
}
