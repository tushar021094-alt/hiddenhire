import { matchJob } from "@/lib/matcher";
import type { Job, SearchFilters } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Candidate={id:string;full_name:string|null;skills:string[];experience_years:number;country:string|null;remote_only:boolean;min_salary:number;salary_currency:string;visibility:string;candidate_profiles?:{target_role:string|null;job_search_mode:string}|null};

export async function matchJobToCandidates(job:Job){
 const admin=createAdminClient();
 const {data,error}=await admin.from("profiles").select("id,full_name,skills,experience_years,country,remote_only,min_salary,salary_currency,visibility,candidate_profiles(target_role,job_search_mode)").eq("role","candidate");
 if(error) throw error;
 const rows=(data as Candidate[]).filter(c=>c.visibility!=="private"&&(!c.candidate_profiles||c.candidate_profiles.job_search_mode!=="not_looking")&&c.candidate_profiles?.target_role);
 const matches=rows.map(candidate=>{
  const profile:SearchFilters={role:c.candidate_profiles!.target_role!,skills:candidate.skills??[],experience:Number(candidate.experience_years)||0,candidateCountry:candidate.country??"India",market:(candidate.country??"India")==="India"?"india":"worldwide",remoteOnly:Boolean(candidate.remote_only),workplace:"any",minCtc:Number(candidate.min_salary)||0,maxCtc:undefined,ctcCurrency:candidate.salary_currency||"INR",states:[],cities:[]};
  const result=matchJob(job,profile);
  return {candidate,result};
 }).filter(x=>resultPasses(x.result));
 return matches.sort((a,b)=>b.result.score-a.result.score).slice(0,50);
}

function resultPasses(result:{score:number;gaps:string[]}){return result.score>=55&&!result.gaps.includes("India eligibility not confirmed");}

export async function persistJobMatches(jobId:string, matches:Awaited<ReturnType<typeof matchJobToCandidates>>){
 const admin=createAdminClient();
 if(!matches.length) return;
 const rows=matches.map(({candidate,result})=>({job_id:jobId,candidate_id:candidate.id,score:result.score,reasons:result.reasons,gaps:result.gaps}));
 const {error}=await admin.from("matches").upsert(rows,{onConflict:"job_id,candidate_id"});
 if(error) throw error;
}
