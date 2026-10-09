"use client";
import { useEffect, useState } from "react";

type Decision = { action: "promote"|"prioritize"|"improve"|"limit"|"hold"; score:number; confidence:"low"|"medium"|"high"; reasons:string[]; nextStep:string };
type Item = { jobId:string; title:string; company:string; status:string; visibility:string; decision:Decision };
type Payload = { items:Item[]; counts:Record<string,number>; error?:string };

const labels: Record<string,string> = { promote:"Promotion candidate", prioritize:"Prioritize", improve:"Needs improvement", limit:"Safety restriction", hold:"Hold" };
export default function MarketplaceOptimizationPage() {
  const [data,setData] = useState<Payload|null>(null);
  const [error,setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/marketplace-optimization").then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load marketplace optimization.");
      if (active) setData(body);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load marketplace optimization."); });
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-7xl px-6 py-10">
    <header className="mb-8">
      <small>MARKETPLACE INTELLIGENCE · PHASE 34</small>
      <h1 className="mt-2 text-3xl font-semibold">Marketplace quality & distribution</h1>
      <p className="mt-2 max-w-3xl text-sm text-white/55">Evidence-based recommendations across job authenticity, recruiter trust, response quality and safety. Recommendations are advisory; moderation restrictions remain enforced separately.</p>
    </header>
    {error && <div className="hh-panel mb-5 text-rose-200">{error}</div>}
    {!data && !error && <div className="hh-panel text-white/55">Loading marketplace signals…</div>}
    {data && <>
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        {["total","promote","prioritize","improve","limit","hold"].map(key => <div key={key} className="hh-panel"><small className="text-white/45">{key==="total"?"Jobs assessed":labels[key]}</small><div className="mt-2 text-2xl font-semibold">{data.counts[key] ?? 0}</div></div>)}
      </section>
      <section className="space-y-3">
        {data.items.length===0 ? <div className="hh-panel text-white/45">No published or pending-review jobs were found.</div> : data.items.map(item => <article key={item.jobId} className="hh-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0"><small className="text-white/40">{item.company} · {item.status.replaceAll("_"," ")}</small><h2 className="mt-1 text-lg font-medium">{item.title}</h2><p className="mt-1 text-xs text-white/35">Job ID: {item.jobId}</p></div>
            <div className="text-right"><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{labels[item.decision.action]}</span><div className="mt-2 text-sm text-white/55">Score {item.decision.score}/100 · {item.decision.confidence} confidence</div></div>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-white/65">{item.decision.reasons.map((reason,index)=><li key={index}>{reason}</li>)}</ul>
          <p className="mt-3 border-t border-white/10 pt-3 text-sm text-cyan-100">{item.decision.nextStep}</p>
        </article>)}
      </section>
    </>}
  </main>;
}
