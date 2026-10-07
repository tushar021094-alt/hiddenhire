import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { isRoleRelevant, matchJob } from "@/lib/matcher";
import { discoverJobs } from "@/lib/sources";
import { usdRate } from "@/lib/currency";
import type { Job, SearchFilters } from "@/lib/types";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_ROLE_LENGTH = 200;
const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 100;
const MAX_LOCATION_FILTERS = 50;
const MAX_LOCATION_LENGTH = 100;
const MAX_CTC = 1_000_000_000;
const MAX_BODY_BYTES = 32_000;

function validProfile(value: unknown): value is SearchFilters {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<SearchFilters>;
  if (
    typeof p.role !== "string" ||
    p.role.trim().length === 0 ||
    p.role.length > MAX_ROLE_LENGTH ||
    !Array.isArray(p.skills) ||
    p.skills.length > MAX_SKILLS ||
    typeof p.experience !== "number" ||
    !Number.isFinite(p.experience) ||
    !Number.isInteger(p.experience) ||
    p.experience < 0 ||
    p.experience > 60 ||
    typeof p.candidateCountry !== "string" ||
    p.candidateCountry.length > MAX_LOCATION_LENGTH ||
    (p.market !== "india" && p.market !== "worldwide") ||
    typeof p.remoteOnly !== "boolean" ||
    !["any", "remote", "hybrid", "onsite"].includes(p.workplace ?? "") ||
    typeof p.minCtc !== "number" ||
    !Number.isFinite(p.minCtc) ||
    p.minCtc < 0 ||
    p.minCtc > MAX_CTC ||
    typeof p.ctcCurrency !== "string" ||
    p.ctcCurrency.length > 10 ||
    !Array.isArray(p.states) ||
    p.states.length > MAX_LOCATION_FILTERS ||
    !Array.isArray(p.cities) ||
    p.cities.length > MAX_LOCATION_FILTERS
  ) return false;

  if (typeof p.maxCtc === "number" && (!Number.isFinite(p.maxCtc) || p.maxCtc < 0 || p.maxCtc > MAX_CTC)) return false;

  if (!p.skills.every(skill => typeof skill === "string" && skill.trim().length > 0 && skill.length <= MAX_SKILL_LENGTH)) return false;

  return [...p.states, ...p.cities].every(
    value => typeof value === "string" && value.trim().length > 0 && value.length <= MAX_LOCATION_LENGTH,
  );
}

const LOCATION_ALIASES: Record<string, string[]> = {
  "new delhi": ["new delhi", "delhi"],
  delhi: ["delhi", "new delhi"],
  gurugram: ["gurugram", "gurgaon"],
  gurgaon: ["gurgaon", "gurugram"],
  bengaluru: ["bengaluru", "bangalore"],
  bangalore: ["bangalore", "bengaluru"],
  "greater noida": ["greater noida", "greaternoida"],
  noida: ["noida"],
  mumbai: ["mumbai", "bombay"],
  kolkata: ["kolkata", "calcutta"],
  chennai: ["chennai", "madras"],
};

const STATE_ALIASES: Record<string, string[]> = {
  "uttar pradesh": ["uttar pradesh", "up"],
  delhi: ["delhi", "new delhi"],
  haryana: ["haryana"],
  karnataka: ["karnataka"],
  maharashtra: ["maharashtra"],
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
  const rate = checkRateLimit(`match:${getClientIdentifier(request)}`, 20, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!validProfile(body)) {
      return NextResponse.json({ error: "Please provide a complete job profile." }, { status: 400 });
    }

    const auth = await getAuthenticatedUser();
    if (!auth.user) {
      return NextResponse.json(
        { error: "Sign in or create a HiddenHire account to search live jobs.", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const liveJobs = await discoverJobs();
    const sourceJobs = liveJobs.length ? liveJobs : demoJobs;
    const currencies = [...new Set(sourceJobs.map(job => job.currency).filter(Boolean))] as string[];
    const rateEntries = await Promise.all(currencies.map(async code => [code, await usdRate(code)] as const));
    const rates = new Map(rateEntries);
    const normalizedJobs = sourceJobs.map(job => {
      const code = job.currency || "USD";
      const rate = rates.get(code) ?? 1;
      return { ...job, currency: code, salaryUsdMin: job.salaryMin != null ? job.salaryMin * rate : undefined, salaryUsdMax: job.salaryMax != null ? job.salaryMax * rate : undefined };
    });
    const profileRate = await usdRate(body.ctcCurrency);
    const minUsd = body.minCtc * profileRate;
    const maxUsd = body.maxCtc && body.maxCtc > 0 ? body.maxCtc * profileRate : undefined;
    const locationEligibleJobs = normalizedJobs.filter(job => locationMatches(job, body));
    const eligibleJobs = locationEligibleJobs.filter(job => {
      if (job.salaryUsdMax != null && job.salaryUsdMax < minUsd) return false;
      if (maxUsd && job.salaryUsdMin != null && job.salaryUsdMin > maxUsd) return false;
      return true;
    });
    const roleEligibleJobs = eligibleJobs.filter(job => isRoleRelevant(job, body));
    const results = roleEligibleJobs.map(job => matchJob(job, { ...body, minCtc: minUsd })).sort((a, b) => b.score - a.score).slice(0, 50);
    return NextResponse.json({ mode: liveJobs.length ? "live" : "demo", sourceCount: sourceJobs.length, locationEligibleCount: locationEligibleJobs.length, salaryEligibleCount: eligibleJobs.length, eligibleCount: roleEligibleJobs.length, results });
  } catch {
    return NextResponse.json({ error: "Job discovery failed. Please try again." }, { status: 500 });
  }
}
