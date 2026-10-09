"use client";
import { useEffect, useState } from "react";

type FunnelRow = { eventName:string; events:number; uniqueActors:number };
type Payload = {
  days:number;
  totals:{events:number;trackedEventTypes:number;uniqueSessions:number;signupCompletionRate:number|null};
  funnel:FunnelRow[];
  topEvents:{eventName:string;count:number}[];
  sources:{source:string;count:number}[];
  daily:{date:string;count:number}[];
  experiments:{priority:"high"|"medium"|"low";title:string;observation:string;experiment:string;metric:string}[];
  truncated:boolean;
};
const labels:Record<string,string> = {
  landing_view:"Landing page views",
  search_started:"Searches started",
  match_results_viewed:"Match results viewed",
  application_click:"Application clicks",
  signup_started:"Sign-ups started",
  signup_completed:"Sign-ups completed",
  job_post_started:"Job posts started",
  job_post_completed:"Job posts completed",
  auth_prompt_shown:"Authentication prompts",
  login_completed:"Logins completed",
};
export default function GrowthAnalyticsPage() {
  const [days,setDays] = useState(30);
  const [data,setData] = useState<Payload|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetch("/api/admin/growth-analytics?days="+days).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load analytics.");
      if (active) setData(body);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load analytics."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[days]);

  const maxDaily = Math.max(1,...(data?.daily.map(item=>item.count) ?? []));
  return <main className="mx-auto max-w-7xl px-6 py-10">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><small className="text-white/45">PLATFORM INTELLIGENCE · PHASE 35</small><h1 className="mt-2 text-3xl font-semibold">Growth & conversion analytics</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Track the funnel from discovery to sign-up and job posting, with source attribution and daily activity. Metrics reflect recorded events, not inferred users.</p></div>
      <label className="text-sm text-white/60">Period <select value={days} onChange={event=>setDays(Number(event.target.value))} className="ml-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
    </header>
    {error && <div className="hh-panel mb-5 text-rose-200">{error}</div>}
    {loading && !data && <div className="hh-panel text-white/55">Loading growth signals…</div>}
    {data && <>
      {data.truncated && <p className="mb-4 text-sm text-amber-200">The result set reached 10,000 events. Counts may be incomplete for this period.</p>}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Recorded events" value={data.totals.events.toLocaleString()} />
        <Metric label="Event types" value={data.totals.trackedEventTypes.toString()} />
        <Metric label="Unique sessions" value={data.totals.uniqueSessions.toLocaleString()} />
        <Metric label="Signup / landing" value={data.totals.signupCompletionRate===null?"—":data.totals.signupCompletionRate+"%"} />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="hh-panel">
          <h2 className="text-lg font-semibold">Conversion funnel</h2><p className="mb-4 mt-1 text-sm text-white/45">Event volume by step; steps are not assumed to be from the same users.</p>
          <div className="space-y-4">{data.funnel.map(item=><div key={item.eventName}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{labels[item.eventName] ?? item.eventName.replaceAll("_"," ")}</span><strong>{item.events.toLocaleString()}</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{width:Math.max(item.events?2:0,item.events/Math.max(1,...data.funnel.map(row=>row.events))*100)+"%"}} /></div><p className="mt-1 text-xs text-white/35">{item.uniqueActors.toLocaleString()} distinct session/profile identifiers</p></div>)}</div>
        </section>
        <section className="hh-panel">
          <h2 className="text-lg font-semibold">Top acquisition sources</h2><p className="mb-4 mt-1 text-sm text-white/45">Attributed events grouped by source and medium.</p>
          {data.sources.length ? <div className="space-y-3">{data.sources.map(item=><div key={item.source} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 text-sm"><span className="text-white/75">{item.source}</span><strong>{item.count.toLocaleString()}</strong></div>)}</div> : <p className="text-sm text-white/45">No attributed events in this period yet.</p>}
          <h3 className="mb-3 mt-6 font-medium">Most recorded events</h3>
          {data.topEvents.map(item=><div key={item.eventName} className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-white/65">{labels[item.eventName] ?? item.eventName.replaceAll("_"," ")}</span><span>{item.count.toLocaleString()}</span></div>)}
        </section>
      </div>
      <section className="hh-panel mt-5">
        <div className="mb-4"><h2 className="text-lg font-semibold">Recommended growth experiments</h2><p className="mt-1 text-sm text-white/45">Rule-based hypotheses generated from recorded funnel signals. Validate with a controlled test before making broad changes.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.experiments.map((item,index)=><article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-xs uppercase tracking-wide text-white/45">Priority · {item.priority}</span><span className="text-xs text-white/35">Experiment {index+1}</span></div>
            <h3 className="mt-2 font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm text-white/65">{item.observation}</p>
            <p className="mt-3 text-sm text-cyan-100">{item.experiment}</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/45">Measure: {item.metric}</p>
          </article>)}
        </div>
      </section>
      <section className="hh-panel mt-5">
        <h2 className="text-lg font-semibold">Daily activity</h2><p className="mb-5 mt-1 text-sm text-white/45">Recorded event count per day.</p>
        {data.daily.length ? <div className="flex h-44 items-end gap-1 overflow-x-auto">{data.daily.map(item=><div key={item.date} className="flex h-full min-w-3 flex-1 flex-col items-center justify-end gap-2" title={item.date+": "+item.count+" events"}><div className="w-full rounded-t bg-violet-300/80" style={{height:Math.max(item.count?3:0,item.count/maxDaily*100)+"%"}}/><span className="text-[9px] text-white/35 [writing-mode:vertical-rl]">{item.date.slice(5)}</span></div>)}</div> : <p className="text-sm text-white/45">No events recorded during this period.</p>}
      </section>
    </>}
  </main>;
}
function Metric({label,value}:{label:string;value:string}) { return <div className="hh-panel"><small className="text-white/45">{label}</small><div className="mt-2 text-2xl font-semibold">{value}</div></div>; }
