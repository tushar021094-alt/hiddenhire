import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExecutionTask, transitionExecutionTask } from "@/lib/career-agent-execution";

export async function GET() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data,error}=await supabase.from("career_execution_tasks").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({tasks:data??[],phase:30});
}

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({}));
  const task=buildExecutionTask({
    id:String(body.id??crypto.randomUUID()),
    action:body.action==="prepare"||body.action==="follow_up"||body.action==="review"||body.action==="apply"?body.action:"review",
    title:String(body.title??"Career agent task"),
    summary:String(body.summary??"Review this career action before execution."),
    requiresApproval:body.requiresApproval!==false,
  });
  const {data,error}=await supabase.from("career_execution_tasks").insert({
    user_id:user.id,application_id:body.applicationId??null,operation_id:body.operationId??null,
    action:task.action,state:task.state,title:task.title,summary:task.summary,
    requires_approval:task.requiresApproval,max_attempts:task.maxAttempts,
  }).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({task:data,phase:30});
}

export async function PATCH(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>({}));
  const taskId=String(body.taskId??"");
  const event=body.event as "approve"|"start"|"complete"|"fail"|"cancel";
  if(!taskId||!["approve","start","complete","fail","cancel"].includes(event))return NextResponse.json({error:"Invalid task transition."},{status:400});
  const {data:existing}=await supabase.from("career_execution_tasks").select("*").eq("id",taskId).eq("user_id",user.id).single();
  if(!existing)return NextResponse.json({error:"Task not found."},{status:404});
  const next=transitionExecutionTask(existing.state,event);
  if(next===existing.state)return NextResponse.json({error:"That transition is not allowed."},{status:409});
  const now=new Date().toISOString();
  const patch:Record<string,unknown>={state:next,updated_at:now};
  if(event==="approve")patch.approved_at=now;
  if(event==="start")patch.started_at=now;
  if(event==="complete")patch.completed_at=now;
  if(event==="fail"){patch.last_error=String(body.error??"Execution failed.");patch.attempts=Number(existing.attempts??0)+1;}
  const {data,error}=await supabase.from("career_execution_tasks").update(patch).eq("id",taskId).eq("user_id",user.id).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({task:data,phase:30});
}
