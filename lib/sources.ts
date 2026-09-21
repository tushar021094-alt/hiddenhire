import type { Job } from "./types";

type GreenhouseJob = { id: number; title: string; location?: { name?: string }; absolute_url: string; updated_at?: string; content?: string; };
type AshbyJob = {
  id: string; title: string; location?: string; jobUrl: string; applyUrl?: string; publishedAt?: string; descriptionPlain?: string;
  isRemote?: boolean; workplaceType?: string;
  address?: { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } };
  compensation?: { summaryComponents?: Array<{ compensationType?: string; currencyCode?: string; minValue?: number | null; maxValue?: number | null }> };
};

const DEFAULT_GREENHOUSE_BOARDS = ["coinbase","okta","samsara","twilio","stripe","doordash","hubspot","brex","rippling","cloudflare","cialfo","mpowerfinancing","6sense","berkadiaindia","zocdoc","narvar","gravitonresearchcapital"];
const DEFAULT_ASHBY_BOARDS = ["notion","ramp","deel","remote","vercel","linear","certa","riveron","HackerOne","reo-dev","almabase","Netspend-Careers-Page","glomo","livekit","TaptapSend","inato","finmid.com","numeral","brigit","unity-advisory","lumilens","pebl","certifyos","better-mortgage","cynlr"];

function stripHtml(value = "") { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }

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

function parseSalary(text: string) {
  const normalized = text.replace(/,/g, "");
  const token = normalized.match(/₹|INR|\$|USD|£|GBP|€|EUR|C\$|CAD|A\$|AUD|AED|SGD/iu)?.[0];
  const currency = !token ? undefined : /₹|INR/i.test(token) ? "INR" : /£|GBP/i.test(token) ? "GBP" : /€|EUR/i.test(token) ? "EUR" : /C\$|CAD/i.test(token) ? "CAD" : /A\$|AUD/i.test(token) ? "AUD" : /AED/i.test(token) ? "AED" : /SGD/i.test(token) ? "SGD" : "USD";
  if (!currency) return {};
  const matches = [...normalized.matchAll(/(?:₹|INR|\$|USD|£|GBP|€|EUR|C\$|CAD|A\$|AUD|AED|SGD)\s*(\d+(?:\.\d+)?)\s*(k|K)?(?:\s*(?:-|–|to)\s*(?:₹|INR|\$|USD|£|GBP|€|EUR|C\$|CAD|A\$|AUD|AED|SGD)?\s*(\d+(?:\.\d+)?)\s*(k|K)?)?/g)];
  for (const m of matches) {
    const min = Number(m[1]) * (m[2] ? 1000 : 1);
    const max = m[3] ? Number(m[3]) * (m[4] ? 1000 : 1) : undefined;
    if (min >= 10000 && min <= 2000000) return { salaryMin: min, salaryMax: max, currency };
  }
  return {};
}

function indiaEligibility(location: string, description: string, country?: string, remote = false) {
  const loc = location.toLowerCase();
  const normalized = normalizeCountry(country);
  if (normalized && normalized !== "India") return false;
  if (/usa|u\.s\.|united states|canada|uk|united kingdom|europe|australia|germany|singapore|uae|dubai/.test(loc)) return false;
  if (/\bindia\b|\bbengaluru\b|\bbangalore\b|\bdelhi\b|\bmumbai\b|\bhyderabad\b|\bpune\b|\bnoida\b|\bgreater noida\b|\bghaziabad\b|\bgurgaon\b|\bgurugram\b|\blucknow\b|\bkanpur\b|\bagra\b|\bvaranasi\b|\bchandigarh\b|\bjaipur\b|\bahmedabad\b|\bsurat\b|\bvadodara\b|\bchennai\b|\bcoimbatore\b|\bkolkata\b|\bkochi\b|\btrivandrum\b|\bindore\b|\bbhopal\b|\bpatna\b|\bbhubaneswar\b|\branchi\b|\bjamshedpur\b|\bludhiana\b|\bamritsar\b|\bdehradun\b|\bharidwar\b/.test(loc)) return true;
  return remote && /remote.{0,30}(india|apac|asia)|(?:india|apac|asia).{0,30}remote/i.test(description);
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
      const remote = /^remote\b/i.test(location) || /\bremote\s*(?:-)?\s*(?:india|apac|asia|worldwide|global)/i.test(location);
      const { city, region, country } = parsePlace(location);
      return makeJob({
        id: `greenhouse-${board}-${job.id}`, title: job.title, company: normalizeCompany(board), location, city, region, country, remote,
        workplaceType: remote ? "Remote" : "On-site", indiaEligible: indiaEligibility(location, text, country, remote),
        source: "Greenhouse", url: job.absolute_url, posted: job.updated_at ?? "Recently updated", description: text.slice(0, 900), ...parseSalary(text),
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

export async function discoverJobs() {
  const greenhouse = (process.env.GREENHOUSE_BOARDS ?? DEFAULT_GREENHOUSE_BOARDS.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const ashby = (process.env.ASHBY_BOARDS ?? DEFAULT_ASHBY_BOARDS.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const [g, a] = await Promise.all([Promise.all(greenhouse.map(fetchGreenhouseBoard)), Promise.all(ashby.map(fetchAshbyBoard))]);
  const unique = new Map<string, Job>();
  for (const job of [...g.flat(), ...a.flat()]) {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${job.location.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, job);
  }
  return [...unique.values()];
}