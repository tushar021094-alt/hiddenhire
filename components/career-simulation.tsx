"use client";

import { useMemo, useState } from "react";
import type { MatchResult } from "@/lib/job-types";
import { applyCareerSimulationChanges, buildCareerSimulation } from "@/lib/career-simulation";

type Props = {
  targetRoles: string[]; preferredLocations: string[]; location: string | null; skills: string[];
  yearsOfExperience: number; minimumSalary: number; remoteOnly: boolean; matches: MatchResult[];
};
type SearchPayload = { results?: MatchResult[]; message?: string };

function delta(value: number) { return value > 0 ? "+" + value : String(value); }

export default function CareerSimulation({ targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly, matches }: Props) {
  const [skillInput, setSkillInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [salaryInput, setSalaryInput] = useState(String(minimumSalary || 0));
  const [remoteInput, setRemoteInput] = useState(remoteOnly);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof buildCareerSimulation> | null>(null);
  const [error, setError] = useState("");

  const baselineProfile = useMemo(() => ({
    resumeText: "", targetJobTitle: targetRoles[0] || "Finance Manager", yearsOfExperience,
    minimumSalary, preferredCurrency: "INR" as const, preferredCountries: ["India"],
    preferredLocations: preferredLocations.length ? preferredLocations : (location ? [location] : ["Delhi NCR"]),
    remoteOnly, preferredIndustries: [], keySkills: skills,
  }), [targetRoles, preferredLocations, location, skills, yearsOfExperience, minimumSalary, remoteOnly]);

  async function simulate() {
    setRunning(true); setError("");
    try {
      const simulatedProfile = applyCareerSimulationChanges(baselineProfile, {
        addSkills: skillInput.split(",").map((value) => value.trim()).filter(Boolean),
        addLocations: locationInput.split(",").map((value) => value.trim()).filter(Boolean),
        minimumSalary: Number(salaryInput), remoteOnly: remoteInput,
      });
      const response = await fetch("/api/jobs/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetJobTitle: simulatedProfile.targetJobTitle, targetRoles, yearsOfExperience: simulatedProfile.yearsOfExperience,
          minimumSalary: simulatedProfile.minimumSalary, preferredCurrency: simulatedProfile.preferredCurrency,
          preferredCountries: simulatedProfile.preferredCountries, preferredLocations: simulatedProfile.preferredLocations,
          remoteOnly: simulatedProfile.remoteOnly, preferredIndustries: simulatedProfile.preferredIndustries,
          skills: simulatedProfile.keySkills, keySkills: simulatedProfile.keySkills,
        }),
      });
      const payload: SearchPayload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Simulation search failed.");
      setResult(buildCareerSimulation(matches, Array.isArray(payload.results) ? payload.results : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally { setRunning(false); }
  }

  const simulatedProfile = useMemo(() => applyCareerSimulationChanges(baselineProfile, {
    addSkills: skillInput.split(",").map((value) => value.trim()).filter(Boolean),
    addLocations: locationInput.split(",").map((value) => value.trim()).filter(Boolean),
    minimumSalary: Number(salaryInput), remoteOnly: remoteInput,
  }), [baselineProfile, skillInput, locationInput, salaryInput, remoteInput]);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.11),transparent_34%),linear-gradient(135deg,rgba(7,16,23,.98),rgba(13,20,40,.9))]">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-cyan-300">Career Simulation</p>
            <h3 className="mt-1 text-xl font-semibold text-white">What if you changed your strategy?</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">Test profile changes against live roles without saving anything. HiddenHire shows the opportunity and interview-probability trade-off before you commit.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-[9px] uppercase tracking-wider text-white/40">No profile changes</span>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <label className="rounded-xl border border-white/10 bg-black/10 p-3">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Add skills</span>
          <input value={skillInput} onChange={(event) => setSkillInput(event.target.value)} placeholder="SAP, FP&A" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" />
          <span className="mt-1 block text-[9px] text-white/25">Comma separated</span>
        </label>
        <label className="rounded-xl border border-white/10 bg-black/10 p-3">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Expand locations</span>
          <input value={locationInput} onChange={(event) => setLocationInput(event.target.value)} placeholder="Delhi, Gurgaon" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" />
          <span className="mt-1 block text-[9px] text-white/25">Add cities without replacing current ones</span>
        </label>
        <label className="rounded-xl border border-white/10 bg-black/10 p-3">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Minimum salary</span>
          <input value={salaryInput} onChange={(event) => setSalaryInput(event.target.value)} type="number" min="0" step="50000" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/30" />
          <span className="mt-1 block text-[9px] text-white/25">INR annual target</span>
        </label>
        <label className="flex cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-black/10 p-3">
          <span><span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Remote preference</span><span className="mt-1 block text-[9px] text-white/25">Simulate remote-only access</span></span>
          <span className="mt-3 flex items-center gap-2 text-xs text-white/65"><input checked={remoteInput} onChange={(event) => setRemoteInput(event.target.checked)} type="checkbox" className="h-4 w-4 accent-cyan-300" /> Remote only</span>
        </label>
      </div>
      <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-[10px] text-white/35">Scenario: {simulatedProfile.keySkills.length - skills.length} new skill(s) · {simulatedProfile.preferredLocations.length - (baselineProfile.preferredLocations?.length || 0)} new location(s) · ₹{simulatedProfile.minimumSalary.toLocaleString("en-IN")} · {simulatedProfile.remoteOnly ? "remote-only" : "location flexible"}</p>
        <button type="button" onClick={() => void simulate()} disabled={running || !matches.length} className="rounded-lg bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/20 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40">{running ? "Simulating live market…" : "Run what-if →"}</button>
      </div>
      {error && <div className="mx-5 mb-4 rounded-lg border border-rose-400/15 bg-rose-400/[.04] p-3 text-[10px] text-rose-200 sm:mx-6">{error}</div>}
      {result && <div className="border-t border-white/10">
        <div className="grid gap-px bg-white/10 sm:grid-cols-5">
          {[
            ["Opportunities", result.deltas.opportunities, result.simulated.opportunities],
            ["Strong matches", result.deltas.strongMatches, result.simulated.strongMatches],
            ["High probability", result.deltas.highProbability, result.simulated.highProbability],
            ["Avg match", result.deltas.averageScore, result.simulated.averageScore],
            ["Avg interview", result.deltas.averageInterviewProbability, result.simulated.averageInterviewProbability],
          ].map(([label, change, value]) => (
            <div key={String(label)} className="bg-[#071017] p-3">
              <p className="text-[9px] uppercase tracking-wider text-white/30">{String(label)}</p>
              <p className={"mt-1 text-lg font-semibold " + (Number(change) > 0 ? "text-emerald-200" : Number(change) < 0 ? "text-rose-200" : "text-white")}>{delta(Number(change))}</p>
              <p className="text-[9px] text-white/35">Scenario: {String(value)}</p>
            </div>
          ))}
        </div>
        <div className="p-5 sm:px-6">
          <p className="text-xs font-semibold text-white/85">{result.summary}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              ["New / unlocked", result.newlyUnlocked, "text-emerald-200"],
              ["Improved", result.improved, "text-cyan-200"],
              ["Trade-offs", result.regressed, "text-amber-200"],
            ].map(([label, items, color]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className={"text-[9px] font-semibold uppercase tracking-wider " + String(color)}>{String(label)}</p>
                <div className="mt-2 space-y-2">
                  {(items as ReturnType<typeof buildCareerSimulation>["newlyUnlocked"]).slice(0, 3).map((item) => (
                    <div key={item.job.id} className="rounded-lg border border-white/8 bg-white/[.02] p-2.5">
                      <p className="truncate text-[10px] font-semibold text-white/80">{item.job.title}</p>
                      <p className="truncate text-[9px] text-white/35">{item.job.company} · {item.simulatedScore}% match · {item.simulatedProbability}% interview probability</p>
                      {item.scoreDelta !== 0 && <p className={"mt-1 text-[9px] " + (item.scoreDelta > 0 ? "text-emerald-200/70" : "text-rose-200/70")}>{delta(item.scoreDelta)} match points</p>}
                    </div>
                  ))}
                  {!(items as ReturnType<typeof buildCareerSimulation>["newlyUnlocked"]).length && <p className="text-[9px] text-white/30">No material changes in this category.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </section>
  );
}
