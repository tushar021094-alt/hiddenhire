import { parseConfiguredSources, type SourceProvider } from "./source-registry";

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

function endpoint(provider: SourceProvider, identifier: string) {
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

function countJobs(provider: SourceProvider, payload: unknown) {
  if (provider === "lever") return Array.isArray(payload) ? payload.length : 0;
  if (!payload || typeof payload !== "object") return 0;
  const jobs = (payload as { jobs?: unknown }).jobs;
  return Array.isArray(jobs) ? jobs.length : 0;
}

async function checkSource(provider: SourceProvider, identifier: string): Promise<SourceHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(endpoint(provider, identifier), {
      headers: { "user-agent": "HiddenHireSourceHealth/1.0", accept: "application/json" },
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

export async function checkRegisteredSources(): Promise<SourceHealth[]> {
  const sources = (["greenhouse", "ashby", "lever", "workable"] as SourceProvider[])
    .flatMap(provider => {
      const envKey = {
        greenhouse: "GREENHOUSE_BOARDS",
        ashby: "ASHBY_BOARDS",
        lever: "LEVER_BOARDS",
        workable: "WORKABLE_SUBDOMAINS",
      }[provider] as keyof NodeJS.ProcessEnv;
      return parseConfiguredSources(provider, process.env[envKey]);
    });

  return Promise.all(sources.map(source => checkSource(source.provider, source.identifier)));
}
