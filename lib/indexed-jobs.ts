import type {Job} from "@/lib/types";
import {createAdminClient} from "@/lib/supabase/admin";
import {fetchAshbyBoard,fetchCareerPage,fetchGreenhouseBoard,fetchLeverBoard,fetchWorkableAccount} from "@/lib/sources";
import {fetchWorkdayBoard} from "@/lib/workday";

type Source={provider:string;identifier:string|null;canonical_url:string;careers_url:string|null};
async function fetchSource(source:Source):Promise<Job[]>{
 if(source.provider==="greenhouse"&&source.identifier) return fetchGreenhouseBoard(source.identifier);
 if(source.provider==="ashby"&&source.identifier) return fetchAshbyBoard(source.identifier);
 if(source.provider==="lever"&&source.identifier) return fetchLeverBoard(source.identifier);
 if(source.provider==="workable"&&source.identifier) return fetchWorkableAccount(source.identifier);
 if(source.provider==="workday"&&source.identifier) return fetchWorkdayBoard(source.identifier);
 return fetchCareerPage(source.careers_url||source.canonical_url);
}
export async function fetchIndexedJobs():Promise<Job[]>{
 try{
  const admin=createAdminClient();
  const {data,error}=await admin.from("company_sources").select("provider,identifier,canonical_url,careers_url").eq("status","active").limit(500);
  if(error) throw error;
  const sources=(data as Source[]).filter(s=>["greenhouse","ashby","lever","workable","workday","structured-jobposting","unknown"].includes(s.provider));
  const batches=await Promise.all(sources.map(fetchSource));
  const unique=new Map<string,Job>();
  for(const job of batches.flat()){
   const key=job.company.toLowerCase()+"|"+job.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()+"|"+job.location.toLowerCase();
   if(!unique.has(key)) unique.set(key,job);
  }
  return [...unique.values()];
 }catch{return [];}
}
