import type { Job } from "./types";
import { parseConfiguredSources } from "./source-registry";

type GreenhouseJob = { id: number; title: string; location?: { name?: string }; absolute_url: string; updated_at?: string; content?: string; };
type LeverJob = {
  id: string; text: string; hostedUrl: string; applyUrl?: string; createdAt?: number;
  descriptionPlain?: string; description?: string; additionalPlain?: string;
  categories?: { location?: string; allLocations?: string[]; team?: string; department?: string; commitment?: string; };
  workplaceType?: string;
};
type AshbyJob = {
  id: string; title: string; location?: string; jobUrl: string; applyUrl?: string; publishedAt?: string; descriptionPlain?: string;
  isRemote?: boolean; workplaceType?: string;
  address?: { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } };
  compensation?: { summaryComponents?: Array<{ compensationType?: string; currencyCode?: string; minValue?: number | null; maxValue?: number | null }> };
};


function decodeHtmlEntities(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2F;|&#47;/gi, "/");
}
function stripHtml(value = "") {
  return decodeHtmlEntities(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const COUNTRY_PATTERNS: Array<[string, RegExp]> = [
  ["India", /\bindia\b|\bindian\b/i],
  ["United States", /\busa\b|\bu\.s\.a?\.?\b|\bunited states\b|\bnew york\b|\bcalifornia\b|\btexas\b/i],
  ["Canada", /\bcanada\b|\btoronto\b|\bvancouver\b|\bmontreal\b/i],
  ["United Kingdom", /\buk\b|\bunited kingdom\b|\blondon\b|\bengland\b/i],
  ["Australia", /\baustralia\b|\bsydney\b|\bmelbourne\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["UAE", /\buae\b|\bunited arab emirates\b|\bdubai\b|\babudhabi\b/i],
  ["Germany", /\bgermany\b|\bberlin\b|\bmunich\b/i],
];

const COUNTRY_ALIASES: Record<string,string> = { IND:"India", IN:"India", INDIA:"India", USA:"United States", US:"United States", "UNITED STATES":"United States", CAN:"Canada", CA:"Canada", CANADA:"Canada", GB:"United Kingdom", UK:"United Kingdom", "UNITED KINGDOM":"United Kingdom", AU:"Australia", AUSTRALIA:"Australia", SG:"Singapore", SINGAPORE:"Singapore", AE:"UAE", UAE:"UAE", DE:"Germany", GERMANY:"Germany" };
function normalizeCountry(value?: string) { if (!value) return undefined; const key=value.trim().toUpperCase(); return COUNTRY_ALIASES[key] ?? value.trim(); }
function detectCountry(location: string, description = "") {
  const match = COUNTRY_PATTERNS.find(([, pattern]) => pattern.test(location));
  if (match) return match[0];
  return /remote.{0,30}(india|apac|asia)|(?:india|apac|asia).{0,30}remote/i.test(description) ? "India" : undefined;
}

function parsePlace(location: string, addressCountry?: string, addressCity?: string, addressRegion?: string) {
  const country = normalizeCountry(addressCountry) || detectCountry(location);
  const parts = location.split(/\s*[-|,•]\s*/).map(v => v.trim()).filter(Boolean);
  const city = addressCity || (parts.length > 1 && !/^remote$/i.test(parts[0]) ? parts[0] : undefined);
  return { city, region: addressRegion, country };
}

function preferredCurrency(country?: string) {
  if (!country) return undefined;
  return ({ India:"INR", "United States":"USD", Canada:"CAD", "United Kingdom":"GBP", Australia:"AUD", UAE:"AED", Singapore:"SGD", Germany:"EUR" } as Record<string,string>)[country];
}

function parseSalary(text: string, country?: string) {
  const normalized = text.replace(/,/g, "");
  const moneyToken = "(?:C\\$|A\\$|₹|INR|USD|\\$|£|GBP|€|EUR|CAD|AUD|AED|SGD)";
  const matches = [...normalized.matchAll(new RegExp(
    `${moneyToken}\\s*(\\d+(?:\\.\\d+)?)\\s*(k|K|l|L|cr|Cr)?(?:\\s*(?:-|–|to)\\s*(?:${moneyToken})?\\s*(\\d+(?:\\.\\d+)?)\\s*(k|K|l|L|cr|Cr)?)?`,
    "g"
  ))];
  const wanted = preferredCurrency(country);
  const multiplier = (suffix?: string) => {
    if (!suffix) return 1;
    if (/^k$/i.test(suffix)) return 1000;
    if (/^l$/i.test(suffix)) return 100000;
    if (/^cr$/i.test(suffix)) return 10000000;
    return 1;
  };
  const toResult = (m: RegExpMatchArray) => {
    const token = m[0].match(new RegExp(moneyToken, "i"))?.[0] ?? "";
    const currency = /₹|INR/i.test(token) ? "INR"
      : /£|GBP/i.test(token) ? "GBP"
      : /€|EUR/i.test(token) ? "EUR"
      : /C\\$|CAD/i.test(token) ? "CAD"
      : /A\\$|AUD/i.test(token) ? "AUD"
      : /AED/i.test(token) ? "AED"
      : /SGD/i.test(token) ? "SGD"
      : "USD";
    return { salaryMin:Number(m[1]) * multiplier(m[2]), salaryMax:m[3] ? Number(m[3]) * multiplier(m[4]) : undefined, currency };
  };
  const candidates = matches.filter(m => {
    const token = m[0].match(new RegExp(moneyToken, "i"))?.[0] ?? "";
    const currency = /₹|INR/i.test(token) ? "INR"
      : /£|GBP/i.test(token) ? "GBP"
      : /€|EUR/i.test(token) ? "EUR"
      : /C\\$|CAD/i.test(token) ? "CAD"
      : /A\\$|AUD/i.test(token) ? "AUD"
      : /AED/i.test(token) ? "AED"
      : /SGD/i.test(token) ? "SGD"
      : "USD";
    return (!wanted || currency === wanted);
  });
  for (const m of candidates) {
    const result = toResult(m);
    if (result.salaryMin >= 10000 && result.salaryMin <= 20000000) return result;
  }
  return {};
}

function indiaEligibility(location: string, description: string, country?: string, remote = false) {
  const loc = location.toLowerCase();
  const normalized = normalizeCountry(country);
  if (normalized) return normalized === "India";
  if (/usa|u\.s\.|united states|canada|uk|united kingdom|europe|australia|germany|singapore|uae|dubai/.test(loc)) return false;
  if (/\bindia\b|\bbengaluru\b|\bbangalore\b|\bdelhi\b|\bmumbai\b|\bhyderabad\b|\bpune\b|\bnoida\b|\bgurgaon\b|\bgurugram\b|\bghaziabad\b|\blucknow\b/.test(loc)) return true;
  if (!remote) return false;
  return /\bremote\b.{0,80}\b(india|apac|asia)\b|\b(india|apac|asia)\b.{0,80}\bremote\b/i.test(`${location} ${description}`);
}

function normalizeCompany(board: string) { return board.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
const makeJob = (base: Omit<Job, "skills"> & { skills?: string[] }): Job => ({ ...base, skills: base.skills ?? [] });

export async function fetchGreenhouseBoard(board: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { jobs?: GreenhouseJob[] };
    return (data.jobs ?? []).map(job => {
      const text = stripHtml(job.content);
      const location = job.location?.name ?? "Location not disclosed";
      const remote = /\bremote\b/i.test(location) && (/\bindia\b|\bapac\b|\basia\b|\bworldwide\b|\bglobal\b/i.test(location) || /\bremote\b.{0,80}\b(india|apac|asia)\b/i.test(text));
      const { city, region, country } = parsePlace(location);
      return makeJob({
        id: `greenhouse-${board}-${job.id}`, title: job.title, company: normalizeCompany(board), location, city, region, country, remote,
        workplaceType: remote ? "Remote" : /\bhybrid\b/i.test(`${location} ${text}`) ? "Hybrid" : "On-site", indiaEligible: indiaEligibility(location, text, country, remote),
        source: "Greenhouse", url: job.absolute_url, posted: job.updated_at ?? "Recently updated", description: text.slice(0, 900), ...parseSalary(text, country),
      });
    });
  } catch { return []; }
}

export async function fetchAshbyBoard(board: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { jobs?: AshbyJob[] };
    return (data.jobs ?? []).filter(job => job.title && job.jobUrl).map(job => {
      const location = job.location ?? "Location not disclosed"; const description = job.descriptionPlain ?? "";
      const remote = Boolean(job.isRemote) || job.workplaceType === "Remote";
      const address = job.address?.postalAddress; const { city, region, country } = parsePlace(location, address?.addressCountry, address?.addressLocality, address?.addressRegion);
      const compensation = job.compensation?.summaryComponents?.find(c => c.compensationType === "Salary" && c.minValue != null);
      return makeJob({
        id: `ashby-${board}-${job.id}`, title: job.title, company: normalizeCompany(board), location, city, region, country, remote,
        workplaceType: job.workplaceType === "Hybrid" ? "Hybrid" : job.workplaceType === "OnSite" ? "On-site" : remote ? "Remote" : "Unknown",
        indiaEligible: indiaEligibility(location, description, country, remote), source: "Ashby", url: job.applyUrl || job.jobUrl,
        posted: job.publishedAt ?? "Recently listed", description: description.slice(0, 900),
        salaryMin: compensation?.minValue ?? undefined, salaryMax: compensation?.maxValue ?? undefined, currency: compensation?.currencyCode ?? undefined,
      });
    });
  } catch { return []; }
}

export async function fetchLeverBoard(board: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as LeverJob[];
    return (Array.isArray(data) ? data : []).filter(job => job.text && job.hostedUrl).map(job => {
      const location = job.categories?.location || job.categories?.allLocations?.join(" / ") || "Location not disclosed";
      const description = stripHtml(job.descriptionPlain || job.description || job.additionalPlain || "");
      const remote = /\bremote\b/i.test(job.workplaceType || "") || /\bremote\b/i.test(location);
      const { city, region, country } = parsePlace(location);
      const posted = job.createdAt ? new Date(job.createdAt).toISOString() : "Recently listed";
      return makeJob({
        id: `lever-${board}-${job.id}`,
        title: job.text,
        company: normalizeCompany(board),
        location,
        city,
        region,
        country,
        remote,
        workplaceType: /\bhybrid\b/i.test(`${job.workplaceType || ""} ${location} ${description}`) ? "Hybrid" : remote ? "Remote" : "On-site",
        indiaEligible: indiaEligibility(location, description, country, remote),
        source: "Lever",
        url: job.hostedUrl || job.applyUrl || "",
        posted,
        description: description.slice(0, 900),
        ...parseSalary(description, country),
      });
    });
  } catch { return []; }
}

type JsonLdJob = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  url?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } } | Array<{ address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }>;
  jobLocationType?: string;
  applicantLocationRequirements?: Array<{ name?: string }>;
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number } };
};

function extractJsonLdJobs(html: string): JsonLdJob[] {
  const jobs: JsonLdJob[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\\s\\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ?? [parsed];
      for (const node of nodes) {
        const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
        if (types.includes("JobPosting")) jobs.push(node as JsonLdJob);
      }
    } catch { /* ignore malformed JSON-LD blocks */ }
  }
  return jobs;
}

export async function fetchCareerPage(url: string): Promise<Job[]> {
  try {
    const response = await fetch(url, { next: { revalidate: 900 }, headers: { "user-agent": "HiddenHireJobIndexer/1.0" } });
    if (!response.ok) return [];
    const html = await response.text();
    return extractJsonLdJobs(html).map((job, index) => {
      const locations = Array.isArray(job.jobLocation) ? job.jobLocation : job.jobLocation ? [job.jobLocation] : [];
      const first = locations[0]?.address;
      const location = first ? [first.addressLocality, first.addressRegion, first.addressCountry].filter(Boolean).join(", ") : job.jobLocationType === "TELECOMMUTE" ? "Remote" : "Location not disclosed";
      const country = normalizeCountry(first?.addressCountry);
      const remote = job.jobLocationType === "TELECOMMUTE" || /remote/i.test(location);
      const salaryValue = job.baseSalary?.value;
      return makeJob({
        id: `career-page-${Buffer.from(url).toString("base64url").slice(0, 18)}-${index}`,
        title: job.title || "Untitled role",
        company: job.hiringOrganization?.name || new URL(url).hostname,
        location,
        city: first?.addressLocality,
        region: first?.addressRegion,
        country,
        remote,
        workplaceType: remote ? "Remote" : "On-site",
        indiaEligible: indiaEligibility(location, stripHtml(job.description ?? ""), country, remote),
        source: "CareerPage",
        url: job.url || url,
        posted: job.datePosted || "Recently listed",
        description: stripHtml(job.description ?? "").slice(0, 900),
        salaryMin: salaryValue?.minValue ?? salaryValue?.value,
        salaryMax: salaryValue?.maxValue,
        currency: job.baseSalary?.currency,
      });
    });
  } catch { return []; }
}

type WorkableJob = {
  title?: string; shortcode?: string; code?: string; country?: string; state?: string; city?: string;
  department?: string; telecommuting?: boolean; published_on?: string; url?: string; application_url?: string;
  shortlink?: string; description?: string; employment_type?: string; industry?: string; function?: string;
  experience?: string; workplace_type?: "on_site" | "hybrid" | "remote";
  salary?: { salary_from?: number; salary_to?: number; salary_currency?: string };
};

export async function fetchWorkableAccount(subdomain: string): Promise<Job[]> {
  try {
    const response = await fetch(`https://www.workable.com/api/accounts/${encodeURIComponent(subdomain)}?details=true`, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { name?: string; jobs?: WorkableJob[] };
    return (data.jobs ?? []).filter(job => job.title && (job.url || job.application_url)).map((job, index) => {
      const locationParts = [job.city, job.state, job.country].filter(Boolean);
      const location = locationParts.join(", ") || "Location not disclosed";
      const description = stripHtml(job.description ?? "");
      const remote = job.workplace_type === "remote" || Boolean(job.telecommuting);
      const country = normalizeCountry(job.country);
      const salary = job.salary;
      return makeJob({
        id: `workable-${subdomain}-${job.shortcode || job.code || index}`,
        title: job.title!,
        company: data.name || normalizeCompany(subdomain),
        location,
        city: job.city,
        region: job.state,
        country,
        remote,
        workplaceType: job.workplace_type === "hybrid" ? "Hybrid" : remote ? "Remote" : "On-site",
        indiaEligible: indiaEligibility(location, description, country, remote),
        source: "Workable",
        url: job.application_url || job.url || job.shortlink || "",
        posted: job.published_on ?? "Recently listed",
        description: description.slice(0, 900),
        salaryMin: salary?.salary_from,
        salaryMax: salary?.salary_to,
        currency: salary?.salary_currency,
      });
    });
  } catch { return []; }
}

export async function discoverJobs() {
  const greenhouse = parseConfiguredSources("greenhouse", process.env.GREENHOUSE_BOARDS);
  const ashby = parseConfiguredSources("ashby", process.env.ASHBY_BOARDS);
  const lever = parseConfiguredSources("lever", process.env.LEVER_BOARDS);
  const workable = parseConfiguredSources("workable", process.env.WORKABLE_SUBDOMAINS);
  const careerPages = (process.env.CAREER_PAGES ?? "").split(",").map(url => url.trim()).filter(Boolean);
  const [g, a, l, w, c] = await Promise.all([
    Promise.all(greenhouse.map(source => fetchGreenhouseBoard(source.identifier))),
    Promise.all(ashby.map(source => fetchAshbyBoard(source.identifier))),
    Promise.all(lever.map(source => fetchLeverBoard(source.identifier))),
    Promise.all(workable.map(source => fetchWorkableAccount(source.identifier))),
    Promise.all(careerPages.map(fetchCareerPage)),
  ]);
  const unique = new Map<string, Job>();
  for (const job of [...g.flat(), ...a.flat(), ...l.flat(), ...w.flat(), ...c.flat()]) {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.location.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, job);
  }
  return [...unique.values()];
}