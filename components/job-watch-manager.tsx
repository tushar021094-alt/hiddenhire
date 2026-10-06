"use client";

import { useCallback, useEffect, useState } from "react";

type Watch = {
  id: string;
  name: string;
  query: string | null;
  target_roles: string[];
  preferred_locations: string[];
  preferred_countries: string[];
  skills: string[];
  minimum_salary: number;
  currency: string;
  remote_only: boolean;
  min_match_score: number;
  enabled: boolean;
  last_scanned_at: string | null;
};

type Event = {
  id: string;
  event_type: string;
  previous_score: number | null;
  current_score: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type Props = {
  targetRoles: string[];
  preferredLocations: string[];
  skills: string[];
  minimumSalary: number;
  currency: string;
  remoteOnly: boolean;
};

function eventLabel(type: string) {
  return ({ new: "NEW OPPORTUNITY", score_increase: "SCORE JUMP", salary_change: "SALARY CHANGE", location_change: "LOCATION CHANGE", reopened: "REOPENED" } as Record<string, string>)[type] ?? type.replace("_", " ");
}

function eventTone(type: string) {
  if (type === "new" || type === "score_increase") return "text-emerald-200 border-emerald-400/20 bg-emerald-400/5";
  if (type === "salary_change") return "text-cyan-200 border-cyan-400/20 bg-cyan-400/5";
  return "text-amber-200 border-amber-400/20 bg-amber-400/5";
}

export default function JobWatchManager(props: Props) {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/job-watches");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load watches.");
      const next = Array.isArray(data.watches) ? data.watches as Watch[] : [];
      setWatches(next);
      if (next.length) {
        const eventResponse = await fetch("/api/job-watches/events");
        const eventData = await eventResponse.json();
        if (eventResponse.ok) setEvents(Array.isArray(eventData.events) ? eventData.events : []);
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load watches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createWatch() {
    setWorking("create");
    setError("");
    try {
      const response = await fetch("/api/job-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: props.targetRoles[0] ? `${props.targetRoles[0]} · ${props.preferredLocations[0] || "India"}` : "My AI Job Watch",
          targetRoles: props.targetRoles,
          preferredLocations: props.preferredLocations,
          preferredCountries: ["India"],
          skills: props.skills,
          minimumSalary: props.minimumSalary,
          currency: props.currency,
          remoteOnly: props.remoteOnly,
          minMatchScore: 70,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to create watch.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create watch.");
    } finally {
      setWorking("");
    }
  }

  async function toggle(watch: Watch) {
    setWorking(watch.id);
    try {
      const response = await fetch(`/api/job-watches/${watch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !watch.enabled }),
      });
      if (!response.ok) throw new Error("Unable to update watch.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update watch.");
    } finally {
      setWorking("");
    }
  }

  async function scan(watch: Watch) {
    setWorking(watch.id);
    setError("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRoles: watch.target_roles,
          targetJobTitle: watch.target_roles[0] || "",
          preferredLocations: watch.preferred_locations,
          preferredCountries: watch.preferred_countries,
          skills: watch.skills,
          minimumSalary: watch.minimum_salary,
          preferredCurrency: watch.currency,
          remoteOnly: watch.remote_only,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Search failed.");
      const scanResponse = await fetch(`/api/job-watches/${watch.id}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: Array.isArray(data.results) ? data.results : [] }),
      });
      const scanData = await scanResponse.json();
      if (!scanResponse.ok) throw new Error(scanData?.error || "Unable to record scan.");
      await load();
      if (scanData.eventsCreated) setError(`${scanData.eventsCreated} new watch signal(s) detected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to scan watch.");
    } finally {
      setWorking("");
    }
  }

  async function remove(watch: Watch) {
    setWorking(watch.id);
    try {
      const response = await fetch(`/api/job-watches/${watch.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete watch.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete watch.");
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-cyan-300/10 bg-white/[0.025] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Persistent intelligence</p>
          <h2 className="mt-2 text-xl font-semibold">Job Watch Network</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Save a search once. HiddenHire fingerprints opportunities and detects meaningful changes instead of showing the same jobs repeatedly.</p>
        </div>
        <button type="button" onClick={() => void createWatch()} disabled={working === "create"} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">
          {working === "create" ? "Creating…" : "+ Save current search"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">{error}</div>}

      {loading ? (
        <div className="mt-5 text-xs text-white/40">Loading watches…</div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-2">
            {watches.length === 0 && <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-xs text-white/40">No persistent watches yet. Save your current candidate search to create one.</div>}
            {watches.map((watch) => (
              <div key={watch.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{watch.name}</div>
                    <div className="mt-1 text-[10px] text-white/40">{watch.target_roles.join(" · ") || "Any role"} · {watch.preferred_locations.join(", ") || "India"} · ≥{watch.min_match_score}%</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-[9px] ${watch.enabled ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200" : "border-white/10 text-white/35"}`}>{watch.enabled ? "ACTIVE" : "PAUSED"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void scan(watch)} disabled={working === watch.id || !watch.enabled} className="rounded-md border border-cyan-300/15 px-2.5 py-1.5 text-[10px] text-cyan-200 disabled:opacity-40">{working === watch.id ? "Scanning…" : "Scan now"}</button>
                  <button type="button" onClick={() => void toggle(watch)} disabled={working === watch.id} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] text-white/55">{watch.enabled ? "Pause" : "Enable"}</button>
                  <button type="button" onClick={() => void remove(watch)} disabled={working === watch.id} className="rounded-md border border-red-300/10 px-2.5 py-1.5 text-[10px] text-red-200/60">Delete</button>
                </div>
                <div className="mt-2 text-[9px] text-white/25">{watch.last_scanned_at ? `Last scanned ${new Date(watch.last_scanned_at).toLocaleString("en-IN")}` : "Not scanned yet"}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Career Agent Inbox</div>
                <div className="mt-1 text-sm font-semibold">Recent opportunity signals</div>
              </div>
              <span className="text-[10px] text-white/30">{events.length} signals</span>
            </div>
            <div className="mt-3 space-y-2">
              {events.length === 0 ? <div className="py-8 text-center text-xs text-white/30">Run a scan to start detecting new opportunities and meaningful changes.</div> : events.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[9px] font-semibold ${eventTone(event.event_type)}`}>{eventLabel(event.event_type)}</span>
                    <span className="text-[9px] text-white/25">{new Date(event.created_at).toLocaleDateString("en-IN")}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-xs font-semibold">{String(event.payload.title || "Opportunity")}</div>
                    {typeof event.payload.priority === "number" && event.payload.priority >= 90 && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-cyan-200">Priority</span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-white/40">{String(event.payload.company || "Company")} · {String(event.payload.location || "Location")}</div>
                  <div className="mt-2 flex gap-2 text-[10px] text-white/50">
                    <span>{event.previous_score === null ? "New" : `${event.previous_score} → ${event.current_score}`}</span>
                    <a href={String(event.payload.applicationUrl || "#")} target="_blank" rel="noreferrer" className="text-cyan-200">Inspect ↗</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
