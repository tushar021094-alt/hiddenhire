"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { MatchResult } from "@/lib/types";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { COUNTRIES, statesFor, citiesFor } from "@/lib/locations";

const COUNTRY_CURRENCY: Record<string, string> = {
  India: "INR", "United States": "USD", "United Kingdom": "GBP", Canada: "CAD", Australia: "AUD",
  UAE: "AED", Singapore: "SGD", Germany: "EUR",
};

export default function Home() {
  const [role,setRole]=useState("Finance Manager"), [skills,setSkills]=useState("FP&A, financial analysis, forecasting, Excel");
  const [experience,setExperience]=useState("6"), [candidateCountry,setCandidateCountry]=useState("India");
  const [market,setMarket]=useState<"india"|"worldwide">("india"), [salaryCurrency,setSalaryCurrency]=useState("INR");
  const [salary,setSalary]=useState("2500000"), [maxSalary,setMaxSalary]=useState("");
  const [remoteOnly,setRemoteOnly]=useState(false), [workplace,setWorkplace]=useState<"any"|"remote"|"hybrid"|"onsite">("any");
  const [jobCountry,setJobCountry]=useState("India"), [state,setState]=useState(""), [city1,setCity1]=useState(""), [city2,setCity2]=useState(""), [showFilters,setShowFilters]=useState(true);
  const [results,setResults]=useState<MatchResult[]>([]), [loading,setLoading]=useState(false), [searched,setSearched]=useState(false);
  const [mode,setMode]=useState<"live"|"demo"|null>(null), [eligibleCount,setEligibleCount]=useState(0), [error,setError]=useState("");
  const states=useMemo(()=>statesFor(jobCountry),[jobCountry]);
  const cities=useMemo(()=>citiesFor(jobCountry,state),[jobCountry,state]);

  useEffect(()=>{
    const nextCurrency=COUNTRY_CURRENCY[candidateCountry] ?? "USD";
    setSalaryCurrency(nextCurrency);
    const defaults: Record<string,string>={India:"2500000","United States":"100000","United Kingdom":"80000",Canada:"120000",Australia:"140000",UAE:"350000",Singapore:"130000",Germany:"90000"};
    setSalary(defaults[candidateCountry] ?? "50000");
    setMaxSalary("");
  },[candidateCountry]);
  useEffect(()=>{ if(market==="india") setJobCountry("India"); },[market]);
  useEffect(()=>{ setState(""); setCity1(""); setCity2(""); },[jobCountry]);
  useEffect(()=>{ if(!cities.includes(city1)) setCity1(""); if(!cities.includes(city2)) setCity2(""); },[state]);
  const currency=useMemo(()=>CURRENCIES.find(c=>c.code===salaryCurrency),[salaryCurrency]);

  async function findJobs(event:FormEvent) {
    event.preventDefault(); setLoading(true); setSearched(true); setError("");
    try {
      const response=await fetch("/api/match",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        role,skills:skills.split(",").map(s=>s.trim()).filter(Boolean),experience:Number(experience),candidateCountry,market,remoteOnly,workplace,
        minCtc:Number(salary),maxCtc:Number(maxSalary),ctcCurrency:salaryCurrency,jobCountry:jobCountry==="Any"?"":jobCountry,state,cities:[city1,city2].filter(Boolean)
      })});
      const data=await response.json(); if(!response.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results ?? []); setMode(data.mode ?? null); setEligibleCount(data.eligibleCount ?? 0);
    } catch(err) { setResults([]);setMode(null);setEligibleCount(0);setError(err instanceof Error?err.message:"Search failed"); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen overflow-hidden">
    <div className="hero-glow"/>
    <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
      <div className="flex items-center gap-3"><div className="brand-mark">H</div><div className="text-lg font-bold tracking-tight">HiddenHire</div></div>
      <div className="hidden items-center gap-7 text-sm text-white/50 sm:flex"><a href="#how-it-works">How it works</a><a href="#sources">Sources</a><a href="#how-it-works">Matching</a></div>
      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">India + global job discovery</div>
    </nav>

    <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="eyebrow"><span className="pulse-dot"/> Intelligent job discovery</div>
        <h1 className="mt-7 text-5xl font-bold tracking-[-0.045em] sm:text-7xl">Find the jobs that<span className="gradient-text block">actually fit you.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Search India or worldwide opportunities, filter by salary and location, and open the original application source.</p>
      </div>

      <form onSubmit={findJobs} className="search-panel mx-auto mt-12 max-w-6xl">
        <div className="panel-top">
          <div><div className="text-sm font-semibold text-white">Build your job profile</div><div className="mt-1 text-xs text-white/40">Choose where you want to work and exactly what results you want.</div></div>
          <button type="button" className="filter-toggle" onClick={()=>setShowFilters(v=>!v)}>{showFilters?"Hide filters":"Show filters"} <span>⌄</span></button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Target role"><input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Finance Manager"/></Field>
          <Field label="Core skills"><input value={skills} onChange={e=>setSkills(e.target.value)} placeholder="FP&A, Excel, forecasting"/></Field>
          <Field label="Experience"><div className="input-suffix"><input type="number" min="0" value={experience} onChange={e=>setExperience(e.target.value)}/><span>years</span></div></Field>
          <Field label="Candidate country"><select value={candidateCountry} onChange={e=>setCandidateCountry(e.target.value)}>{["India","United States","United Kingdom","Canada","Australia","UAE","Singapore","Germany"].map(c=><option key={c}>{c}</option>)}</select></Field>
        </div>

        {showFilters && <div className="filter-grid mt-5">
          <Field label="Job market"><select value={market} onChange={e=>setMarket(e.target.value as "india"|"worldwide")}><option value="india">India only</option><option value="worldwide">Worldwide</option></select></Field>
          <Field label="Minimum CTC / PA"><div className="input-suffix"><span>{currency?.symbol}</span><input type="number" min="0" value={salary} onChange={e=>setSalary(e.target.value)}/><select className="currency-select" value={salaryCurrency} onChange={e=>setSalaryCurrency(e.target.value)}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}</select></div></Field>
          <Field label="Maximum CTC / PA"><div className="input-suffix"><span>{currency?.symbol}</span><input type="number" min="0" value={maxSalary} onChange={e=>setMaxSalary(e.target.value)}/><span>{salaryCurrency}</span></div></Field>
          <Field label="Preferred cities"><input value={cities} onChange={e=>setCities(e.target.value)} placeholder="Noida, Delhi, Gurugram"/></Field>
          <Field label="State / region"><input value={region} onChange={e=>setRegion(e.target.value)} placeholder="Uttar Pradesh"/></Field>
          <Field label="Workplace"><select value={workplace} onChange={e=>setWorkplace(e.target.value as typeof workplace)}><option value="any">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></Field>
        </div>}

        <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="toggle-row"><input type="checkbox" checked={remoteOnly} onChange={e=>setRemoteOnly(e.target.checked)}/><span className="toggle"/><span><strong>Remote only</strong><small>{market==="india"?"Only roles explicitly workable from India":"Remote roles only"}</small></span></label>
          <button disabled={loading} className="primary-button">{loading?"Finding your matches…":"Find my matches"} <span>→</span></button>
        </div>
      </form>
      <div className="mx-auto mt-5 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/30"><span>✓ Employer sources</span><span>✓ CTC + currency filters</span><span>✓ Country → state → city filters</span><span>✓ Direct application links</span></div>
    </section>

    {searched && <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="section-kicker">YOUR MATCHES</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Roles ranked around your profile</h2></div>
        {!loading&&!error&&<div className="flex items-center gap-3 text-xs text-white/40"><span className={mode==="live"?"live-badge":"demo-badge"}>{mode==="live"?"● LIVE SOURCES":"● DEMO FALLBACK"}</span><span>{eligibleCount} eligible</span></div>}
      </div>
      {loading?<div className="loading-card">Searching employer sources and applying your filters<span className="loading-dots">...</span></div>
       :error?<div className="empty-card"><div className="empty-icon">!</div><h3>Search unavailable</h3><p>{error}</p></div>
       :results.length===0?<div className="empty-card"><div className="empty-icon">⌕</div><h3>No matching roles found</h3><p>Try broadening your salary, city, region or workplace filters.</p></div>
       :<div className="grid gap-5 lg:grid-cols-2">{results.map(job=><JobCard key={job.id} job={job}/>)}</div>}
    </section>}

    <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <div className="mb-7 max-w-xl"><div className="section-kicker">HOW HIDDENHIRE WORKS</div><h2 className="mt-2 text-3xl font-semibold tracking-tight">Search less. Control more.</h2></div>
      <div className="grid gap-4 sm:grid-cols-3">{[["01","Discover","Find opportunities through employer career sources and public feeds."],["02","Filter","Narrow results by salary, city, state and workplace type."],["03","Apply","Go straight to the original application page."]].map(([n,t,d])=><div className="feature-card" key={n}><div className="feature-number">{n}</div><h3>{t}</h3><p>{d}</p></div>)}</div>
    </section>
    <section id="sources" className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-sm text-white/45">HiddenHire preserves the source location and compensation when the provider publishes them. Results link to the original employer/application page.</div></section>
    <footer className="relative z-10 border-t border-white/[0.07] px-5 py-8 text-center text-xs text-white/30">HiddenHire · India + global job discovery · Direct applications</footer>
  </main>;
}

function JobCard({job}:{job:MatchResult}) {
  const score=Math.max(0,Math.min(100,job.score));
  const salary=job.salaryMin?formatMoney(job.salaryMin,job.currency)+"–"+formatMoney(job.salaryMax??job.salaryMin,job.currency):"Not disclosed";
  return <article className="job-card">
    <div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="company-line"><span className="company-logo">{job.company.slice(0,1).toUpperCase()}</span><span>{job.company}</span></div><h3 className="mt-4 text-xl font-semibold tracking-tight">{job.title}</h3><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40"><span>{job.location}</span><span>•</span><span>{job.remote?"Remote":job.workplaceType??"Location"}</span></div></div><div className="score-ring" style={{"--score":`${score*3.6}deg`} as CSSProperties}><strong>{score}</strong><span>MATCH</span></div></div>
    <div className="mt-6 grid grid-cols-2 gap-3"><Stat label="Salary" value={salary}/><Stat label="Source / country" value={`${job.source} · ${job.country??"Not disclosed"}`}/></div>
    <p className="mt-5 text-sm leading-6 text-white/50">{job.description}</p>
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Why this matches</div><ul className="mt-2 space-y-2 text-sm text-white/65">{job.reasons.slice(0,4).map(r=><li key={r}><span className="mr-2 text-cyan-300">✓</span>{r}</li>)}</ul></div>
    {job.gaps.length>0&&<div className="mt-3 text-xs text-amber-300/70">Potential gap · {job.gaps.join(" · ")}</div>}
    <a href={job.url} target="_blank" rel="noreferrer" className="apply-button mt-5">View original application <span>↗</span></a>
  </article>;
}
function Field({label,children}:{label:string;children:ReactNode}) { return <label className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">{label}<div className="mt-2">{children}</div></label>; }
function Stat({label,value}:{label:string;value:string}) { return <div className="stat-box"><div>{label}</div><strong>{value}</strong></div>; }