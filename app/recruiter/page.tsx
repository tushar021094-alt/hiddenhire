"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VerificationPanel from "./verification-panel";
type CreatedJob = {
  id: string;
  company_id: string | null;
  posted_by: string;
  title: string;
  description: string;
  city: string | null;
  region: string | null;
  country: string;
  remote: boolean;
  workplace_type: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  experience_min: number | null;
  experience_max: number | null;
  status: string;
  visibility: string;
  created_at: string;
};

type AiNormalized = {
  role: string;
  skills: string[];
};
type CandidateMatch = {
  candidateId: string;
  name: string | null;
  headline: string | null;
  score: number;
  opportunityScore: number;
  matchTier: string;
  roleClassification: string;
  reasons: string[];
  missingRequirements: string[];
};

export default function RecruiterPage(){
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
      }
    }

    void checkAuth();
  }, [router]);
 const [form,setForm]=useState({
  title:"Finance Manager",
  company:"",
  description:"Own budgeting, forecasting, management reporting and financial analysis.",
  jobFunction:"Finance",
  skills:"FP&A, financial analysis, forecasting, Excel",
  city:"",
  region:"Uttar Pradesh",
  country:"India",
  remote:true,
  salaryMin:"1500000",
  salaryMax:"2500000",
  experienceMin:"5",
  experienceMax:"10"
});
 const [job, setJob] = useState<CreatedJob | null>(null);
const [ai, setAi] = useState<AiNormalized | null>(null);
const [matches, setMatches] = useState<CandidateMatch[]>([]);
 const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
 async function submit(e:React.FormEvent){
  e.preventDefault();setLoading(true);setError("");
  try{
   const r=await fetch("/api/recruiter/jobs",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...form,skills:form.skills.split(",").map(s=>s.trim()).filter(Boolean),salaryMin:Number(form.salaryMin),salaryMax:Number(form.salaryMax),experienceMin:Number(form.experienceMin),experienceMax:Number(form.experienceMax)})});
   const d = await r.json();

if (!r.ok) {
  throw new Error(d.error || "Job creation failed");
}

setJob(d.job);
setAi(d.aiNormalized);
setMatches(Array.isArray(d.matches) ? d.matches : []);
  }catch(e){setError(e instanceof Error?e.message:"Matching failed")}finally{setLoading(false)}
 }
 const set=(k:keyof typeof form,v:string)=>setForm(x=>({...x,[k]:v}));
 return <main className="app-v2 recruiter-v2 min-h-screen bg-[#08090d] px-5 py-10 text-white"><div className="mx-auto max-w-6xl">
  <div className="mb-10"><div className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Recruiter workspace</div>
   <h1 className="mt-3 text-4xl font-bold">Post a job. Let HiddenHire find the candidates.</h1>
   <p className="mt-3 max-w-2xl text-white/50">The same relevance-first engine works in reverse: job function, skills, experience, location, compensation and seniority.</p>
  </div>
<VerificationPanel />

  <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-white/10 bg-white/[.03] p-6 md:grid-cols-2">
   {([["title","Job title"],["company","Company"],["city","City"],["region","State / region"],["country","Country"],["salaryMin","Minimum salary"],["salaryMax","Maximum salary"],["experienceMin","Minimum experience"],["experienceMax","Maximum experience"]] as const).map(([k,l])=>
    <label key={k} className="text-xs uppercase tracking-wider text-white/40">{l}<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={String(form[k])} onChange={e=>set(k,e.target.value)}/></label>)}
   <label className="text-xs uppercase tracking-wider text-white/40">
  Job function
  <select
    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
    value={form.jobFunction}
    onChange={(e) => set("jobFunction", e.target.value)}
    required
  >
    {[
      "Finance",
      "Accounting",
      "FP&A",
      "Audit",
      "Tax",
      "Treasury",
      "Risk",
      "Operations",
      "Engineering",
      "Software",
      "Data",
      "Product",
      "Marketing",
      "Sales",
      "HR",
      "Legal",
      "Customer Success",
      "Design",
      "Other",
    ].map((functionName) => (
      <option
        key={functionName}
        value={functionName}
        className="bg-slate-900 text-white"
      >
        {functionName}
      </option>
    ))}
  </select>
</label>
<label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">Skills<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={form.skills} onChange={e=>set("skills",e.target.value)}/></label>
   <label className="text-xs uppercase tracking-wider text-white/40 md:col-span-2">Job description<textarea rows={7} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={form.description} onChange={e=>set("description",e.target.value)}/></label>
   <label className="flex items-center gap-3 text-sm text-white/70 md:col-span-2"><input type="checkbox" checked={form.remote} onChange={e=>setForm(x=>({...x,remote:e.target.checked}))}/> Remote role</label>
   <button disabled={loading} className="rounded-xl bg-white px-5 py-3 font-semibold text-black md:col-span-2">{loading?"AI is understanding the job and finding candidates…":"Post job & find candidates →"}</button>
  </form>
  {error&&<div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}

   {job && (
  <section className="mt-10">
    <div className="text-xs uppercase tracking-[.2em] text-white/35">
      Job created
    </div>

    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{job.title}</h2>

          <p className="mt-2 text-sm text-white/50">
            {job.city || "India"} · {job.region || "India"} ·{" "}
            {job.remote ? "Remote" : "On-site"}
          </p>

          <p className="mt-2 text-xs text-white/35">
            Created {new Date(job.created_at).toLocaleString()}
          </p>
        </div>

        <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-xs text-amber-200">
          {job.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white/[.03] p-4">
          <div className="text-xs uppercase tracking-wider text-white/35">
            Salary
          </div>
          <div className="mt-2 text-sm text-white/80">
            {job.salary_min != null || job.salary_max != null
              ? `${job.currency || "INR"} ${job.salary_min?.toLocaleString() || "—"} – ${job.salary_max?.toLocaleString() || "—"}`
              : "Not specified"}
          </div>
        </div>

        <div className="rounded-xl bg-white/[.03] p-4">
          <div className="text-xs uppercase tracking-wider text-white/35">
            Experience
          </div>
          <div className="mt-2 text-sm text-white/80">
            {job.experience_min != null || job.experience_max != null
              ? `${job.experience_min ?? "—"} – ${job.experience_max ?? "—"} years`
              : "Not specified"}
          </div>
        </div>

        <div className="rounded-xl bg-white/[.03] p-4">
          <div className="text-xs uppercase tracking-wider text-white/35">
            Workplace
          </div>
          <div className="mt-2 text-sm text-white/80">
            {job.workplace_type}
          </div>
        </div>
      </div>
    </div>

    {ai && (
      <div className="mt-6">
        <div className="text-xs uppercase tracking-[.2em] text-white/35">
          AI job understanding
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <strong>{ai.role}</strong>

          <div className="mt-3 flex flex-wrap gap-2">
            {ai.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-100"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    )}

    <div className="mt-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.03] p-5">
  <div className="text-xs uppercase tracking-[.2em] text-cyan-300/70">
    AI candidate matches
  </div>

  <div className="mt-2 flex items-center justify-between gap-4">
    <div>
      <div className="text-lg font-semibold text-white">
        {matches.length} candidate{matches.length === 1 ? "" : "s"} found
      </div>
      <p className="mt-1 text-sm text-white/50">
        Ranked using HiddenHire&apos;s relevance-first matching engine.
      </p>
    </div>
  </div>

  {matches.length === 0 ? (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm text-white/50">
      No active candidates matched this job yet.
    </div>
  ) : (
    <div className="mt-5 grid gap-4">
      {matches.map((candidate, index) => (
        <div
          key={candidate.candidateId}
          className="rounded-xl border border-white/10 bg-white/[.03] p-5"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/35">
                  #{index + 1}
                </span>

                <h3 className="text-lg font-semibold text-white">
                  {candidate.name || "Candidate"}
                </h3>
              </div>

              {candidate.headline && (
                <p className="mt-1 text-sm text-white/50">
                  {candidate.headline}
                </p>
              )}

              <p className="mt-2 text-xs text-cyan-200/70">
                {candidate.roleClassification}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-100">
                {candidate.matchTier}
              </span>

              <span className="text-2xl font-bold text-white">
                {candidate.score}
              </span>
            </div>
          </div>

          {candidate.reasons.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-white/35">
                Why this matches
              </div>

              <ul className="mt-2 space-y-1">
                {candidate.reasons.map((reason) => (
                  <li
                    key={reason}
                    className="text-sm text-white/65"
                  >
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.missingRequirements.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-white/35">
                Missing requirements
              </div>

              <ul className="mt-2 space-y-1">
                {candidate.missingRequirements.map((requirement) => (
                  <li
                    key={requirement}
                    className="text-sm text-amber-200/70"
                  >
                    • {requirement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>
 </section>
  )}
</div>
</main>
}
