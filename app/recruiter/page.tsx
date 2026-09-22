"use client";
import {useState} from "react";
import type {CandidateMatch} from "@/lib/recruiter-types";

export default function RecruiterPage(){
 const [form,setForm]=useState({
  title:"Finance Manager",company:"",description:"Own budgeting, forecasting, management reporting and financial analysis.",
  skills:"FP&A, financial analysis, forecasting, Excel",city:"",region:"Uttar Pradesh",country:"India",
  remote:true,salaryMin:"1500000",salaryMax:"2500000",experienceMin:"5",experienceMax:"10"
 });
 const [matches,setMatches]=useState<CandidateMatch[]>([]);
 const [ai,setAi]=useState<{role:string;skills:string[]}|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();setLoading(true);setError("");
  try{
   const r=await fetch("/api/recruiter/jobs",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...form,skills:form.skills.split(",").map(s=>s.trim()).filter(Boolean),salaryMin:Number(form.salaryMin),salaryMax:Number(form.salaryMax),experienceMin:Number(form.experienceMin),experienceMax:Number(form.experienceMax)})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Matching failed");
   setAi(d.aiNormalized);setMatches(d.matches||[]);
  }catch(e){setError(e instanceof Error?e.message:"Matching failed")}finally{setLoading(false)}
 }
 const set=(k:keyof typeof form,v:string)=>setForm(x=>({...x,[k]:v}));
 return <main className="min-h-screen bg-[#08090d] px-5 py-10 text-white"><div className="mx-auto max-w-6xl">
  <div className="mb-10"><div className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Recruiter workspace</div>
   <h1 className="mt-3 text-4xl font-bold">Post a job. Let HiddenHire find the candidates.</h1>
   <p className="mt-3 max-w-2xl text-white/50">The same relevance-first engine works in reverse: job function, skills, experience, location, compensation and seniority.</p>
  </div>
  <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-white/10 bg-white/[.03] p-6 md:grid-cols-2">
   {([["title","Job title"],["company","Company"],["city","City"],["region","State / region"],["country","Country"],["salaryMin","Minimum salary"],["salaryMax","Maximum salary"],["experienceMin","Minimum experience"],["experienceMax","Maximum experience"]] as const).map(([k,l])=>
    <label key={k} className="text-xs uppercase tracking-wider text-white/40">{l}<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={String(form[k])} onChange={e=>set(k,e.target.value)}/></label>)}
   <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">Skills<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={form.skills} onChange={e=>set("skills",e.target.value)}/></label>
   <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">Job description<textarea rows={7} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={form.description} onChange={e=>set("description",e.target.value)}/></label>
   <label className="flex items-center gap-3 text-sm text-white/70 md:col-span-2"><input type="checkbox" checked={form.remote} onChange={e=>setForm(x=>({...x,remote:e.target.checked}))}/> Remote role</label>
   <button disabled={loading} className="rounded-xl bg-white px-5 py-3 font-semibold text-black md:col-span-2">{loading?"AI is understanding the job and finding candidates…":"Post job & find candidates →"}</button>
  </form>
  {error&&<div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}
  {ai&&<section className="mt-10">
   <div className="text-xs uppercase tracking-[.2em] text-white/35">AI job understanding</div>
   <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-5"><strong>{ai.role}</strong><div className="mt-3 flex flex-wrap gap-2">{ai.skills.map(s=><span key={s} className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-100">{s}</span>)}</div></div>
   <div className="mt-8 flex items-end justify-between"><div><div className="text-xs uppercase tracking-[.2em] text-white/35">Top candidates</div><h2 className="mt-2 text-2xl font-semibold">{matches.length} matches found</h2></div><span className="text-xs text-white/35">Demo candidate pool</span></div>
   <div className="mt-5 grid gap-4 md:grid-cols-2">{matches.map(c=><article key={c.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">{c.fullName}</h3><p className="mt-1 text-sm text-white/45">{c.currentTitle} · {c.experienceYears} years</p><p className="mt-1 text-xs text-white/35">{c.location}</p></div><div className="text-right"><strong className="text-2xl">{c.score}</strong><div className="text-[10px] uppercase tracking-widest text-white/35">match</div></div></div>
    <div className="mt-4 space-y-2 text-sm text-white/60">{c.reasons.slice(0,4).map(r=><div key={r}>✓ {r}</div>)}</div>
    {c.gaps.length>0&&<div className="mt-4 text-xs text-amber-300/70">Review: {c.gaps.join(" · ")}</div>}
    <div className="mt-4 flex flex-wrap gap-2">{c.matchedSkills.map(s=><span key={s} className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-white/55">{s}</span>)}</div>
   </article>)}</div>
  </section>}
 </div></main>
}