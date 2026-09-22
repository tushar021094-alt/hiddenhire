"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage(){
  const router=useRouter();
  const [mode,setMode]=useState<"signin"|"signup">("signin");
  const [role,setRole]=useState<"candidate"|"employer">("candidate");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage("");
    const supabase=createClient();
    if(mode==="signin"){
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error) setMessage(error.message); else router.push(role==="employer"?"/recruiter":"/dashboard");
    }else{
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{role,full_name:name}}});
      if(error) setMessage(error.message);
      else if(data.session) router.push(role==="employer"?"/recruiter":"/dashboard");
      else setMessage("Account created. Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }
  return <main className="min-h-screen px-5 py-10 sm:px-8"><div className="mx-auto max-w-md pt-16">
    <a href="/" className="text-sm text-cyan-300">← Back to HiddenHire</a>
    <div className="mt-8 search-panel">
      <div className="eyebrow"><span className="pulse-dot"/> HiddenHire account</div>
      <h1 className="mt-5 text-3xl font-semibold">{mode==="signin"?"Welcome back":"Create your account"}</h1>
      <p className="mt-2 text-sm text-white/40">{mode==="signin"?"Continue your career intelligence journey.":"Choose how you want to use HiddenHire."}</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode==="signup"&&<Field label="Full name"><input value={name} onChange={e=>setName(e.target.value)} required /></Field>}
        {mode==="signup"&&<Field label="I am a"><select value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="candidate">Candidate</option><option value="employer">Recruiter / Employer</option></select></Field>}
        <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></Field>
        <Field label="Password"><input type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required /></Field>
        {message&&<div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3 text-sm text-white/60">{message}</div>}
        <button className="primary-button w-full justify-center" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"} <span>→</span></button>
      </form>
      <button className="mt-5 text-sm text-white/45 hover:text-white" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setMessage("")}}>{mode==="signin"?"New here? Create an account":"Already have an account? Sign in"}</button>
    </div>
  </div></main>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-xs font-medium uppercase tracking-[0.12em] text-white/40">{label}<div className="mt-2">{children}</div></label>}
