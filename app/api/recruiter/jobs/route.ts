import {NextResponse} from "next/server";
import OpenAI from "openai";
import type {CandidateProfile,RecruiterJob} from "@/lib/recruiter-types";
import {matchCandidate} from "@/lib/recruiter-matcher";

const demoCandidates:CandidateProfile[]=[
{id:"demo-c1",fullName:"Aarav Sharma",currentTitle:"Finance Manager",headline:"Finance & FP&A professional",summary:"Management reporting, forecasting, budgeting and financial analysis.",skills:["FP&A","financial analysis","forecasting","Excel","management reporting"],experienceYears:8,location:"Noida, Uttar Pradesh",country:"India",remoteOnly:true,minSalary:1800000,salaryCurrency:"INR",preferredLocations:["Noida","Delhi NCR","Remote"],visibility:"match_only"},
{id:"demo-c2",fullName:"Priya Mehta",currentTitle:"Senior Financial Analyst",headline:"FP&A and business finance",summary:"Financial planning, variance analysis, budgeting and business partnering.",skills:["FP&A","budgeting","forecasting","financial reporting","Excel"],experienceYears:6,location:"Gurugram, Haryana",country:"India",remoteOnly:false,minSalary:1500000,salaryCurrency:"INR",preferredLocations:["Gurugram","Delhi NCR"],visibility:"match_only"},
{id:"demo-c3",fullName:"Rohan Verma",currentTitle:"Accounting Manager",headline:"Accounting and controllership",summary:"Close, reconciliations, AP, controls and financial reporting.",skills:["Accounting","reconciliation","AP","controls","Excel"],experienceYears:9,location:"Greater Noida, Uttar Pradesh",country:"India",remoteOnly:true,minSalary:1600000,salaryCurrency:"INR",preferredLocations:["Greater Noida","Noida","Remote"],visibility:"match_only"},
{id:"demo-c4",fullName:"Neha Kapoor",currentTitle:"Finance Operations Lead",headline:"Finance operations and analytics",summary:"Finance operations, process improvement, controls and reporting.",skills:["Finance operations","process improvement","controls","reporting","Excel"],experienceYears:7,location:"Bengaluru, Karnataka",country:"India",remoteOnly:true,minSalary:2000000,salaryCurrency:"INR",preferredLocations:["Bengaluru","Remote"],visibility:"match_only"}
];

async function normalizeJob(job:RecruiterJob){
 const apiKey=process.env.OPENAI_API_KEY;
 if(!apiKey)return {role:job.title,skills:job.skills};
 try{
  const client=new OpenAI({apiKey});
  const r=await client.chat.completions.create({
   model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0,response_format:{type:"json_object"},
   messages:[
    {role:"system",content:"Normalize a job for candidate matching. Return JSON only: {role:string,skills:string[]}. Preserve the actual job function and do not invent requirements."},
    {role:"user",content:JSON.stringify({title:job.title,description:job.description,skills:job.skills})}
   ]
  });
  const parsed=JSON.parse(r.choices[0]?.message?.content||"{}");
  return {role:typeof parsed.role==="string"?parsed.role:job.title,skills:Array.isArray(parsed.skills)?parsed.skills.filter((x:any)=>typeof x==="string").slice(0,20):job.skills};
 }catch{return {role:job.title,skills:job.skills};}
}

export async function POST(request:Request){
 try{
  const body=await request.json() as Partial<RecruiterJob>;
  if(!body.title?.trim()||!body.description?.trim())return NextResponse.json({error:"Job title and description are required."},{status:400});
  const job:RecruiterJob={
   title:body.title.trim(),description:body.description.trim(),company:body.company?.trim()||"HiddenHire Demo Company",
   city:body.city,region:body.region,country:body.country||"India",remote:Boolean(body.remote),
   salaryMin:body.salaryMin,salaryMax:body.salaryMax,currency:body.currency||"INR",
   experienceMin:body.experienceMin,experienceMax:body.experienceMax,
   skills:Array.isArray(body.skills)?body.skills.filter(Boolean).slice(0,30):[],normalizedSkills:[]
  };
  const ai=await normalizeJob(job);
  job.normalizedRole=ai.role; job.normalizedSkills=ai.skills;
  const matches=demoCandidates.filter(c=>c.visibility!=="private").map(c=>matchCandidate(job,c)).sort((a,b)=>b.score-a.score).slice(0,10);
  return NextResponse.json({mode:"demo",aiNormalized:{role:job.normalizedRole,skills:job.normalizedSkills},candidateCount:demoCandidates.length,matches});
 }catch{return NextResponse.json({error:"Recruiter matching failed. Please try again."},{status:500});}
}