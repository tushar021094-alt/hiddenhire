import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
 try{
  const {user}=await requireRole(["candidate"]);
  const body=await request.json() as {role?:string;skills?:string[];experience?:number;country?:string};
  if(!body.role?.trim()) return NextResponse.json({error:"Target role is required."},{status:400});
  const admin=createAdminClient();
  const {error}=await admin.from("profiles").update({skills:Array.isArray(body.skills)?body.skills.slice(0,30):[],experience_years:Math.max(0,Number(body.experience)||0),country:body.country?.trim()||null}).eq("id",user.id);
  if(error) throw error;
  const {error:cpError}=await admin.from("candidate_profiles").upsert({profile_id:user.id,job_search_mode:"active"});
  if(cpError) throw cpError;
  return NextResponse.json({ok:true});
 }catch(error){
  const status=error instanceof Error&&error.message==="AUTH_REQUIRED"?401:error instanceof Error&&error.message==="FORBIDDEN"?403:500;
  return NextResponse.json({error:error instanceof Error?error.message:"Profile update failed."},{status});
 }
}
