import type { Job } from "@/lib/types";

type WorkdayTarget = {
  tenant: string;
  site: string;
  origin: string;
  locale: string;
};

type WorkdayPosting = {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
  remoteType?: string;
  timeType?: string;
};

type WorkdayDetail = {
  jobPostingInfo?: {
    title?: string;
    jobReqId?: string;
    jobPostingId?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    timeType?: string;
    remoteType?: string;
    canApply?: boolean;
  };
};

function parseTarget(identifier: string): WorkdayTarget {
  const [tenant, site, origin, locale = "en-US"] = identifier.split("|");
  if (!tenant || !site || !origin) throw new Error("Invalid Workday source identifier.");
  return { tenant, site, origin: origin.replace(/\/$/, ""), locale };
}

export function workdayIdentifier(tenant: string, site: string, origin: string, locale = "en-US") {
  return [tenant, site, origin.replace(/\/$/, ""), locale].join("|");
}

function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function countryFromLocation(value = "") {
  if (/\bindia\b/i.test(value)) return "India";
  if (/\b(united states|usa)\b/i.test(value)) return "United States";
  if (/\b(canada)\b/i.test(value)) return "Canada";
  if (/\b(united kingdom|uk|england)\b/i.test(value)) return "United Kingdom";
  if (/\b(australia)\b/i.test(value)) return "Australia";
  if (/\b(singapore)\b/i.test(value)) return "Singapore";
  if (/\b(germany)\b/i.test(value)) return "Germany";
  if (/\b(uae|united arab emirates)\b/i.test(value)) return "UAE";
  return undefined;
}

function parseLocation(value = "") {
  const parts = value.split(/\s*,\s*/).map(v => v.trim()).filter(Boolean);
  const country = countryFromLocation(value);
  const city = parts.length >= 2 ? parts[0] : undefined;
  return { city, country };
}

function indiaEligible(location: string, description: string, country?: string, remote = false) {
  if (country) return country === "India";
  const text = (location + " " + description).toLowerCase();
  if (/\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|noida|gurugram|gurgaon|delhi|chennai|kolkata|jaipur)\b/.test(text)) return true;
  return remote && /\b(remote|hybrid)\b/.test(text) && /\b(india|apac|asia)\b/.test(text);
}

function parseSalary(description: string, country?: string) {
  const normalized = description.replace(/,/g, "");
  const preferred = country === "India" ? "INR" : country === "United States" ? "USD" : undefined;
  const regex = /(?:₹|INR|USD|\$|GBP|£|EUR|€)\s*(\d+(?:\.\d+)?)\s*(k|K|l|L|cr|Cr)?(?:\s*(?:-|–|to)\s*(?:₹|INR|USD|\$|GBP|£|EUR|€)?\s*(\d+(?:\.\d+)?)\s*(k|K|l|L|cr|Cr)?)?/g;
  const multiplier = (s?: string) => !s ? 1 : /^k$/i.test(s) ? 1000 : /^l$/i.test(s) ? 100000 : /^cr$/i.test(s) ? 10000000 : 1;
  for (const m of normalized.matchAll(regex)) {
    const token = m[0];
    const currency = /₹|INR/i.test(token) ? "INR" : /£|GBP/i.test(token) ? "GBP" : /€|EUR/i.test(token) ? "EUR" : "USD";
    if (preferred && currency !== preferred) continue;
    const min = Number(m[1]) * multiplier(m[2]);
    if (min < 10000 || min > 20000000) continue;
    return { salaryMin: min, salaryMax: m[3] ? Number(m[3]) * multiplier(m[4]) : undefined, currency };
  }
  return {};
}

async function postJobs(target: WorkdayTarget, offset: number) {
  const endpoint = target.origin + "/wday/cxs/" + encodeURIComponent(target.tenant) + "/" + encodeURIComponent(target.site) + "/jobs";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "en-US" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Workday jobs request failed (${response.status}).`);
  return await response.json() as { total?: number; jobPostings?: WorkdayPosting[] };
}

async function getDetail(target: WorkdayTarget, posting: WorkdayPosting) {
  if (!posting.externalPath) return undefined;
  const endpoint = target.origin + "/wday/cxs/" + encodeURIComponent(target.tenant) + "/" + encodeURIComponent(target.site) + posting.externalPath;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "Accept-Language": "en-US" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  return await response.json() as WorkdayDetail;
}

export async function fetchWorkdayBoard(identifier: string, maxJobs = 100): Promise<Job[]> {
  const target = parseTarget(identifier);
  const postings: WorkdayPosting[] = [];
  for (let offset = 0; offset < maxJobs; offset += 20) {
    const page = await postJobs(target, offset);
    const batch = page.jobPostings ?? [];
    if (!batch.length) break;
    postings.push(...batch);
    if (batch.length < 20 || postings.length >= Math.min(maxJobs, page.total ?? maxJobs)) break;
  }

  const jobs: Job[] = [];
  for (let start = 0; start < postings.length; start += 10) {
    const batch = postings.slice(start, start + 10);
    const details = await Promise.all(batch.map(posting => getDetail(target, posting)));
    for (let i = 0; i < batch.length; i++) {
      const posting = batch[i];
      const info = details[i]?.jobPostingInfo;
      const location = info?.location || posting.locationsText || "Location not disclosed";
      const description = stripHtml(info?.jobDescription || "");
      const remoteText = [info?.remoteType, posting.remoteType, location, description].filter(Boolean).join(" ");
      const remote = /\bremote\b/i.test(remoteText);
      const { city, country } = parseLocation(location);
      const slug = posting.externalPath || `/${posting.title || "job"}`;
      const jobUrl = `${target.origin}/${target.locale}/${target.site}${slug}`;
      const stableId = info?.jobReqId || info?.jobPostingId || slug;
      jobs.push({
        id: `workday-${target.tenant}-${target.site}-${stableId}`,
        title: info?.title || posting.title || "Untitled role",
        company: target.tenant.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        location,
        city,
        country,
        remote,
        workplaceType: /\bhybrid\b/i.test(remoteText) ? "Hybrid" : remote ? "Remote" : "On-site",
        indiaEligible: indiaEligible(location, description, country, remote),
        source: "Workday",
        url: jobUrl,
        posted: info?.startDate || posting.postedOn || "Recently listed",
        description: (description || posting.bulletFields?.join(" ") || posting.title || "Untitled role").slice(0, 900),
        skills: [],
        ...parseSalary(description, country),
      });
    }
  }
  return jobs;
}
