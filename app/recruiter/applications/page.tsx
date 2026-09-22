import {requireRole} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";

export default async function RecruiterApplications(){
 const {user}=await requireRole(["employer","agency"]); const admin=createAdminClient();
 const {data:apps}=await admin.from("applications").select("id,status,created_at,jobs!inner(id,title,posted_by),profiles!inner(full_name,email,experience_years,skills)").eq("jobs.posted_by",user.id).order("created_at",{ascending:false}).limit(200);
 return <main className="min-h-screen px-5 py-10 sm:px-8"><div className="mx-auto max-w-6xl">
  <div className="flex items-end justify-between"><div><div className="section-kicker">HIRING PIPELINE</div><h1 className="mt-2 text-4xl font-semibold">Applications</h1><p className="mt-2 text-white/40">Review candidates who applied to your HiddenHire jobs.</p></div><a href="/recruiter" className="secondary-button">Post another job</a></div>
  <div className="mt-8 grid gap-4">{(apps??[]).length===0?<div className="empty-card"><h3>No applications yet</h3><p>Applications will appear here as candidates apply.</p></div>:(apps??[]).map((app:any)=><article className="job-card" key={app.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs text-white/35">{app.jobs?.title}</div><h2 className="mt-1 text-xl font-semibold">{app.profiles?.full_name||"Candidate"}</h2><div className="mt-2 text-sm text-white/40">{app.profiles?.experience_years??0} years · {(app.profiles?.skills??[]).slice(0,5).join(" · ")}</div></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">{app.status}</span></div></article>))}</div>
 </div></main>
}
