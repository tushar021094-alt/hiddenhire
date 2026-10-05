"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MatchResult } from "@/lib/job-types";

type ApplicationSummary = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  jobs?: { title: string | null; company?: { name: string | null } | { name: string | null }[] | null } | null;
};

type Props = {
  targetRoles: string[];
  preferredLocations: string[];
  location: string | null;
  skills: string[];
  yearsOfExperience: number;
  minimumSalary: number;
  remoteOnly: boolean;
  applications: ApplicationSummary[];
};

function companyName(company: ApplicationSummary["jobs"] extends infer T ? T extends { company?: infer C } ? C : never : never) {
  if (Array.isArray(company)) return company[0]?.name || "Company";
  return company?.name || "Company";
}

function ageInDays(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export default function CareerAgent({ targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly, applications }: Props) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeApplications = useMemo(
    () => applications.filter((item) => !["rejected", "withdrawn", "hired"].includes(item.status)),
    [applications],
  );

  const followUps = useMemo(
    () => activeApplications.filter((item) => item.status === "applied" && ageInDays(item.created_at) >= 5),
    [activeApplications],
  );

  const interviews = useMemo(
    () => applications.filter((item) => item.status === "interview"),
    [applications],
  );

  async function scan() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetJobTitle: targetRoles[0] || "Finance Manager",
          targetRoles,
          yearsOfExperience,
          minimumSalary,
          preferredCurrency: "INR",
          preferredCountries: ["India"],
          preferredLocations: preferredLocations.length ? preferredLocations : (location ? [location] : ["Delhi NCR"]),
          remoteOnly,
          preferredIndustries: [],
          skills,
          keySkills: skills,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Agent scan failed.");
      setMatches(Array.isArray(payload?.results) ? payload.results : []);
      setLastScan(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent scan failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void scan();
  }, []);

  const highMatches = matches.filter((item) => item.score >= 70).slice(0, 3);
  const nextAction =
    interviews.length > 0
      ? "Prepare for your active interview"
      : followUps.length > 0
        ? "Follow up on older applications"
        : highMatches.length > 0
          ? "Review new high-match opportunities"
          : "Refresh your profile and scan again";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.06] via-white/[0.025] to-blue-500/[0.04]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Proactive Career Agent</p>
            <h2 className="mt-1 text-xl font-semibold">Your next best move</h2>
            <p className="mt-1 text-xs text-white/50">Live opportunity scan + application follow-up intelligence, without auto-submitting applications.</p>
          </div>
          <button type="button" onClick={() => void scan()} disabled={loading} className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">
            {loading ? "Scanning…" : "Scan opportunities"}
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-4">
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">High matches</p>
          <p className="mt-1 text-2xl font-semibold">{highMatches.length}</p>
          <p className="mt-1 text-[10px] text-emerald-200/70">70%+ fit</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Follow-ups</p>
          <p className="mt-1 text-2xl font-semibold">{followUps.length}</p>
          <p className="mt-1 text-[10px] text-amber-200/70">5+ days without movement</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Interviews</p>
          <p className="mt-1 text-2xl font-semibold">{interviews.length}</p>
          <p className="mt-1 text-[10px] text-cyan-200/70">active stage</p>
        </div>
        <div className="bg-[#071017] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Next move</p>
          <p className="mt-1 text-sm font-semibold leading-5">{nextAction}</p>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">New opportunity signals</p>
            {lastScan && <span className="text-[10px] text-white/30">Scanned {lastScan}</span>}
          </div>
          {error && <p className="mt-3 text-xs text-amber-200">{error}</p>}
          {!error && highMatches.length === 0 && !loading && (
            <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">No 70%+ opportunities in this scan. Try widening location, role or salary preferences.</p>
          )}
          <div className="mt-3 space-y-2">
            {highMatches.map((match) => (
              <div key={match.job.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{match.job.title}</div>
                  <div className="mt-0.5 truncate text-[10px] text-white/45">{match.job.company} · {match.job.remote ? "Remote" : match.job.location}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[10px] font-bold text-emerald-200">{match.score}%</span>
                  <Link href="/jobs" className="text-[10px] font-semibold text-cyan-200 hover:text-cyan-100">Inspect →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Action queue</p>
          <div className="mt-3 space-y-2">
            {followUps.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-amber-400/15 bg-amber-400/[0.03] p-3">
                <p className="text-xs font-semibold">{item.jobs?.title || "Application"}</p>
                <p className="mt-1 text-[10px] text-white/45">{companyName(item.jobs?.company)} · {ageInDays(item.created_at)} days since applying</p>
                <Link href="/applications" className="mt-2 inline-block text-[10px] font-semibold text-amber-200">Open tracker →</Link>
              </div>
            ))}
            {interviews.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] p-3">
                <p className="text-xs font-semibold">{item.jobs?.title || "Interview"}</p>
                <p className="mt-1 text-[10px] text-white/45">{companyName(item.jobs?.company)} · interview stage</p>
                <Link href="/applications" className="mt-2 inline-block text-[10px] font-semibold text-cyan-200">Prepare →</Link>
              </div>
            ))}
            {!followUps.length && !interviews.length && (
              <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/45">No urgent application actions. The agent is watching your pipeline.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
