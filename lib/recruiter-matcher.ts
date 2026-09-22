import type { CandidateProfile, RecruiterJob, CandidateMatch } from "./recruiter-types";

const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9+.#& ]/g," ").replace(/\s+/g," ").trim();
const tokens=(v:string)=>normalize(v).split(" ").filter(t=>t.length>1&&!["the","and","for","with","role","job"].includes(t));
const ALIASES:Record<string,string[]>={
 finance:["finance","financial","accounting","accounts"], accounting:["accounting","accountant","accounts","finance"],
 "financial analyst":["financial analyst","finance analyst","fp&a","fpa","financial planning"],
 "finance manager":["finance manager","financial manager","accounting manager","finance lead"],
 sales:["sales","business development","account executive","account manager"],
 "business development":["business development","sales","account executive"],
 hr:["hr","human resources","people","talent"], recruitment:["recruitment","recruiting","talent acquisition","sourcing"],
 marketing:["marketing","growth","digital","brand"], software:["software","developer","engineering","engineer"],
 operations:["operations","business operations"], procurement:["procurement","purchasing","sourcing"]
};
function hit(text:string,term:string){const n=normalize(term);return !!n&&(" "+text+" ").includes(" "+n+" ");}
function aliases(term:string){return ALIASES[normalize(term)]??[normalize(term)];}
function roleScore(jobRole:string,candidate:CandidateProfile){
 const wanted=tokens(jobRole), text=normalize([candidate.currentTitle,candidate.headline,candidate.skills.join(" "),candidate.summary].join(" "));
 if(!wanted.length)return 0;
 const direct=wanted.filter(t=>aliases(t).some(a=>hit(text,a))).length;
 const phrase=aliases(jobRole).some(a=>hit(text,a));
 return Math.min(40,Math.round(direct/wanted.length*28)+(phrase?12:0));
}
function skillScore(jobSkills:string[],candidate:CandidateProfile){
 if(!jobSkills.length)return {score:0,matched:[] as string[]};
 const text=normalize([candidate.skills.join(" "),candidate.summary,candidate.headline].join(" "));
 const matched=jobSkills.filter(s=>aliases(s).some(a=>hit(text,a))||tokens(s).some(t=>hit(text,t)));
 return {score:Math.min(15,Math.round(matched.length/jobSkills.length*15)),matched};
}
function experienceScore(min:number|undefined,max:number|undefined,years:number){
 if(min==null&&max==null)return 15;
 if(min!=null&&years<min)return Math.max(0,15-Math.round((min-years)*5));
 if(max!=null&&years>max+3)return 8;
 return 15;
}
function locationScore(job:RecruiterJob,candidate:CandidateProfile){
 if(job.remote)return candidate.remoteOnly?10:8;
 if(!job.city&&!job.region)return 7;
 const text=normalize([candidate.location,candidate.preferredLocations.join(" ")].join(" "));
 return [job.city,job.region].filter(Boolean).some(v=>hit(text,v!))?10:2;
}
function salaryScore(job:RecruiterJob,candidate:CandidateProfile){
 if(!job.salaryMin||!candidate.minSalary)return 7;
 const max=job.salaryMax??job.salaryMin;
 if(max<candidate.minSalary)return 0;
 return job.salaryMin>candidate.minSalary?10:7;
}
function seniorityScore(jobRole:string,candidate:CandidateProfile){
 const jt=normalize(jobRole), ct=normalize(candidate.currentTitle);
 for(const pair of [["director","director"],["head","head"],["manager","manager"],["lead","lead"],["senior","senior"],["analyst","analyst"]]) {
  if(hit(jt,pair[0])&&hit(ct,pair[1]))return 5;
 }
 return 3;
}
export function matchCandidate(job:RecruiterJob,candidate:CandidateProfile):CandidateMatch{
 const role=roleScore(job.normalizedRole||job.title,candidate);
 const skills=skillScore(job.normalizedSkills.length?job.normalizedSkills:job.skills,candidate);
 const experience=experienceScore(job.experienceMin,job.experienceMax,candidate.experienceYears);
 const location=locationScore(job,candidate), salary=salaryScore(job,candidate);
 const seniority=seniorityScore(job.normalizedRole||job.title,candidate), company=job.company?5:2;
 const score=Math.min(100,role+skills.score+experience+location+salary+seniority+company);
 const reasons=[
  role>=28?"Strong role/function alignment":role>=18?"Relevant role/function overlap":"Limited role alignment",
  skills.matched.length?skills.matched.length+" relevant skill"+(skills.matched.length===1?"":"s")+" matched":"Limited skill overlap",
  experience>=15?"Experience range aligned":experience>=10?"Experience is close to the requested range":"Experience gap detected",
  location>=8?(job.remote?"Remote preference compatible":"Location aligns"):"Location may require review",
  salary>=7?"Compensation appears compatible":"Compensation may require review"
 ];
 const gaps=[
  ...(role<18?["Role/function alignment is limited"]:[]),
  ...(skills.matched.length<Math.min(2,job.skills.length)?["Skill overlap is limited"]:[]),
  ...(experience<10?["Experience range may not align"]:[]),
  ...(location<8?["Location compatibility is uncertain"]:[]),
  ...(salary<7?["Salary compatibility is uncertain"]:[])
 ];
 return {...candidate,score,reasons,gaps,matchedSkills:skills.matched};
}