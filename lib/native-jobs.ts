import type { Job } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Row={id:string;title:string;description:string;location:string|null;city:string|null;region:string|null;country:string|null;remote:boolean;workplace_type:"Remote"|"Hybrid"|"On-site"|"Unknown";salary_min:number|null;salary_max:number|null;currency:string|null;published_at:string|null;expires_at:string|null;source_type:string;external_job_id:string|null;companies?:{name?:string|null}|null};

export async function fetchPublishedJobs():Promise<Job[]>{
 try{
  const admin=createAdminClient();
  const expiry=new Date().toISOString();
  const {data,error}=await admin.from("jobs").select("id,title,description,location,city,region,country,remote,workplace_type,salary_min,salary_max,currency,published_at,expires_at,source_type,external_job_id,companies(name)").eq("status","published").or("expires_at.is.null,expires_at.gt."+expiry).order("published_at",{ascending:false}).limit(5000);
  if(error) throw error;
  return (data as Row[]).map(row=>({id:"native-"+row.id,title:row.title,company:row.companies?.name??"HiddenHire employer",location:row.location??"Location not disclosed",city:row.city??undefined,region:row.region??undefined,country:row.country??undefined,remote:row.remote,workplaceType:row.workplace_type,salaryMin:row.salary_min??undefined,salaryMax:row.salary_max??undefined,currency:row.currency??undefined,source:"HiddenHire",url:"/jobs/"+row.id,posted:row.published_at??"Recently listed",description:row.description.slice(0,900),skills:[],indiaEligible:(row.country??"").toLowerCase()==="india"||/india/i.test(row.location??"")||row.remote}));
 }catch{return [];}
}
