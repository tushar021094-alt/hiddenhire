import {notFound} from "next/navigation";
import {createAdminClient} from "@/lib/supabase/admin";
import ApplyButton from "./ApplyButton";

export default async function JobPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const admin=createAdminClient();
 const {data,error}=await admin.from("jobs").select("*,companies(name,website)").eq("id",id).eq("status","published").maybeSingle();
 if(error||!data) notFound();
 const compensation=data.salary_min?String(data.currency??"")+" "+Number(data.salary_min).toLocaleString()+(data.salary_max?" – "+Number(data.salary_max).toLocaleString():""):"Not disclosed";
 const experience=data.experience_min!=null?String(data.experience_min)+"–"+String(data.experience_max??data.experience_min)+"+ years":"See description";
 return <main className="min-h-screen px-5 py-10 sm:px-8"><div className="mx-auto max-w-4xl">
  <a href="/" className="text-sm text-cyan-300">← Back to matches</a>
  <article className="job-card mt-7">
   <div className="section-kicker">HIDDENHIRE OPPORTUNITY</div>
   <h1 className="mt-3 text-4xl font-semibold tracking-tight">{data.title}</h1>
   <div className="mt-3 text-white/50">{data.companies?.name??"Employer"} · {data.location??"Location not disclosed"} · {data.workplace_type}</div>
   <div className="mt-6 grid grid-cols-2 gap-3"><Stat label="Compensation" value={compensation}/><Stat label="Experience" value={experience}/></div>
   <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-white/65">{data.description}</div>
   <ApplyButton jobId={data.id}/>{(data.application_url||data.companies?.website)&&<a className="apply-button mt-4" href={data.application_url||data.companies?.website} target="_blank" rel="noreferrer">Open employer application <span>↗</span></a>}
  </article>
 </div></main>
}
function Stat({label,value}:{label:string;value:string}){return <div className="stat-box"><div>{label}</div><strong>{value}</strong></div>}
