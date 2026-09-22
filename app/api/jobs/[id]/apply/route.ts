import {NextResponse} from "next/server";
import {requireRole} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";

export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {user}=await requireRole(["candidate"]); const {id}=await params; const admin=createAdminClient();
  const {data:job,error:jobError}=await admin.from("jobs").select("id,status").eq("id",id).maybeSingle();
  if(jobError) throw jobError; if(!job||job.status!=="published") return NextResponse.json({error:"This job is no longer accepting applications."},{status:404});
  const {data,error}=await admin.from("applications").upsert({job_id:id,candidate_id:user.id,status:"applied"},{onConflict:"job_id,candidate_id"}).select("id,status").single();
  if(error) throw error;
  return NextResponse.json({application:data});
 }catch(error){
  const message=error instanceof Error?error.message:"Application failed.";
  return NextResponse.json({error:message},{status:message==="AUTH_REQUIRED"?401:message==="FORBIDDEN"?403:500});
 }
}
