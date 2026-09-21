import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { matchJob } from "@/lib/matcher";
import { discoverJobs } from "@/lib/sources";
import { usdRate } from "@/lib/currency";
import type { Job, SearchFilters } from "@/lib/types";

function validProfile(value: unknown): value is SearchFilters {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<SearchFilters>;
  return typeof p.role === "string" && Array.isArray(p.skills) && typeof p.experience === "number"
    && typeof p.candidateCountry === "string" && (p.market === "india" || p.market === "worldwide")
    && typeof p.remoteOnly === "boolean" && ["any","remote","hybrid","onsite"].includes(p.workplace ?? "")
    && typeof p.minCtc === "number" && typeof p.ctcCurrency === "string" && Array.isArray(p.cities);
}
function locationMatches(job: Job, filters: SearchFilters) {
  if (filters.market === "india" && !job.indiaEligible) return false;\n  if (filters.jobCountry && filters.jobCountry !== "Worldwide" && job.country && job.country.toLowerCase() !== filters.jobCountry.toLowerCase()) return false;
  if (filters.remoteOnly && !job.remote) return false;
  if (filters.workplace !== "any") {
    const wanted = filters.workplace === "onsite" ? "On-site" : filters.workplace[0].toUpperCase() + filters.workplace.slice(1);
    if (job.workplaceType !== wanted) return false;
  }
  const cities = filters.cities.map(c => c.trim().toLowerCase()).filter(Boolean);
  if (cities.length) {
    const haystack = `${job.location} ${job.city ?? ""}`.toLowerCase();
    if (!cities.some(city => haystack.includes(city))) return false;
  }
  if (filters.state?.trim()) {
    const region = filters.state.trim().toLowerCase();
    if (!`${job.region ?? ""} ${job.location}`.toLowerCase().includes(region)) return false;
  }
  return true;
}
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!validProfile(body)) return NextResponse.json({ error: "Please provide a complete job profile." }, { status: 400 });
    const liveJobs = await discoverJobs(); const sourceJobs = liveJobs.length ? liveJobs : demoJobs;
    const currencies = [...new Set(sourceJobs.map(job => job.currency).filter(Boolean))] as string[];
    const rates = new Map<string, number>();
    for (const code of currencies) rates.set(code, await usdRate(code));
    const normalizedJobs = sourceJobs.map(job => {
      const code = job.currency || "USD"; const rate = rates.get(code) ?? 1;
      return { ...job, currency: code, salaryUsdMin: job.salaryMin != null ? job.salaryMin * rate : undefined, salaryUsdMax: job.salaryMax != null ? job.salaryMax * rate : undefined };
    });
    const profileRate = await usdRate(body.ctcCurrency); const minUsd = body.minCtc * profileRate; const maxUsd = body.maxCtc && body.maxCtc > 0 ? body.maxCtc * profileRate : undefined;
    const eligibleJobs = normalizedJobs.filter(job => {
      if (!locationMatches(job, body)) return false;
      if (job.salaryUsdMin != null && job.salaryUsdMin < minUsd) return false;
      if (maxUsd && job.salaryUsdMin != null && job.salaryUsdMin > maxUsd) return false;
      return true;
    });
    const results = eligibleJobs.map(job => matchJob(job, { ...body, minCtc: minUsd })).sort((a,b) => b.score-a.score).slice(0,50);
    return NextResponse.json({ mode: liveJobs.length ? "live" : "demo", sourceCount: sourceJobs.length, eligibleCount: eligibleJobs.length, results });
  } catch { return NextResponse.json({ error: "Job discovery failed. Please try again." }, { status: 500 }); }
}