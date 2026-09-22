import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { isRoleRelevant, matchJob } from "@/lib/matcher";
import { discoverJobs } from "@/lib/sources";
import { usdRate } from "@/lib/currency";
import type { Job, SearchFilters } from "@/lib/types";
import { fetchPublishedJobs } from "@/lib/native-jobs";
import { fetchIndexedJobs } from "@/lib/indexed-jobs";

function validProfile(value: unknown): value is SearchFilters {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<SearchFilters>;
  return typeof p.role === "string" && Array.isArray(p.skills) && typeof p.experience === "number"
    && typeof p.candidateCountry === "string" && (p.market === "india" || p.market === "worldwide")
    && typeof p.remoteOnly === "boolean" && ["any","remote","hybrid","onsite"].includes(p.workplace ?? "")
    && typeof p.minCtc === "number" && typeof p.ctcCurrency === "string" && Array.isArray(p.states) && Array.isArray(p.cities);
}
const LOCATION_ALIASES: Record<string, string[]> = {
  "new delhi": ["new delhi", "delhi"],
  "delhi": ["delhi", "new delhi"],
  "gurugram": ["gurugram", "gurgaon"],
  "gurgaon": ["gurgaon", "gurugram"],
  "bengaluru": ["bengaluru", "bangalore"],
  "bangalore": ["bangalore", "bengaluru"],
  "greater noida": ["greater noida", "greaternoida"],
  "noida": ["noida"],
  "mumbai": ["mumbai", "bombay"],
  "kolkata": ["kolkata", "calcutta"],
  "chennai": ["chennai", "madras"],
};

const STATE_ALIASES: Record<string, string[]> = {
  "uttar pradesh": ["uttar pradesh", "up"],
  "delhi": ["delhi", "new delhi"],
  "haryana": ["haryana"],
  "karnataka": ["karnataka"],
  "maharashtra": ["maharashtra"],
};

function locationMatches(job: Job, filters: SearchFilters) {
  if (filters.market === "india" && !job.indiaEligible) return false;

  if (filters.jobCountry && filters.jobCountry !== "Worldwide") {
    const wantedCountry = filters.jobCountry.toLowerCase();
    if (wantedCountry === "india") {
      if (!job.indiaEligible) return false;
    } else if (!job.country || job.country.toLowerCase() !== wantedCountry) {
      return false;
    }
  }

  if (filters.remoteOnly && !job.remote) return false;

  if (filters.workplace !== "any") {
    const wanted = filters.workplace === "onsite" ? "On-site" : filters.workplace[0].toUpperCase() + filters.workplace.slice(1);
    if (job.workplaceType !== wanted) return false;
  }

  const cities = filters.cities.map(c => c.trim().toLowerCase()).filter(Boolean);
  const states = (filters.states ?? []).map(s => s.trim().toLowerCase()).filter(Boolean);

  // "Any" workplace allows remote roles, but explicit physical location
  // filters mean the user is asking for jobs tied to those places.
  // Remote-only is handled above and therefore intentionally bypasses this.
  if (job.remote && (cities.length || states.length)) return false;
  if (job.remote) return true;
  if (cities.length) {
    const haystack = `${job.location} ${job.city ?? ""}`.toLowerCase();
    const matchesCity = cities.some(city => {
      const aliases = LOCATION_ALIASES[city] ?? [city];
      return aliases.some(alias => haystack.includes(alias));
    });
    if (!matchesCity) return false;
  }

  if (states.length) {
    const jobLocation = `${job.region ?? ""} ${job.location}`.toLowerCase();
    const matchesState = states.some(state => {
      const aliases = STATE_ALIASES[state] ?? [state];
      return aliases.some(alias => jobLocation.includes(alias));
    });
    if (!matchesState) return false;
  }

  return true;
}
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!validProfile(body)) return NextResponse.json({ error: "Please provide a complete job profile." }, { status: 400 });
    const [liveJobs,nativeJobs,indexedJobs] = await Promise.all([discoverJobs(), fetchPublishedJobs(), fetchIndexedJobs()]);
    const combined = new Map<string, Job>();
    for (const job of [...liveJobs, ...indexedJobs, ...nativeJobs]) {
      const key = `${job.company.toLowerCase()}|${job.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}|${job.location.toLowerCase()}`;
      if (!combined.has(key)) combined.set(key, job);
    }
    const sourceJobs = combined.size ? [...combined.values()] : demoJobs;
    const currencies = [...new Set(sourceJobs.map(job => job.currency).filter(Boolean))] as string[];
    const rateEntries = await Promise.all(currencies.map(async code => [code, await usdRate(code)] as const));
    const rates = new Map(rateEntries);
    const normalizedJobs = sourceJobs.map(job => {
      const code = job.currency || "USD"; const rate = rates.get(code) ?? 1;
      return { ...job, currency: code, salaryUsdMin: job.salaryMin != null ? job.salaryMin * rate : undefined, salaryUsdMax: job.salaryMax != null ? job.salaryMax * rate : undefined };
    });
    const profileRate = await usdRate(body.ctcCurrency); const minUsd = body.minCtc * profileRate; const maxUsd = body.maxCtc && body.maxCtc > 0 ? body.maxCtc * profileRate : undefined;
    const locationEligibleJobs = normalizedJobs.filter(job => locationMatches(job, body));
    const eligibleJobs = locationEligibleJobs.filter(job => {
      if (job.salaryUsdMax != null && job.salaryUsdMax < minUsd) return false;
      if (maxUsd && job.salaryUsdMin != null && job.salaryUsdMin > maxUsd) return false;
      return true;
    });
    const roleEligibleJobs = eligibleJobs.filter(job => isRoleRelevant(job, body));
    const results = roleEligibleJobs.map(job => matchJob(job, { ...body, minCtc: minUsd })).sort((a,b) => b.score-a.score).slice(0,50);
    return NextResponse.json({ mode: combined.size ? "live" : "demo", sourceCount: sourceJobs.length, locationEligibleCount: locationEligibleJobs.length, salaryEligibleCount: eligibleJobs.length, eligibleCount: roleEligibleJobs.length, results });
  } catch { return NextResponse.json({ error: "Job discovery failed. Please try again." }, { status: 500 }); }
}