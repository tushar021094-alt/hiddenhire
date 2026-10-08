"use client";
import { useState } from "react";

export default function ModerationAppealCard({ caseId, jobTitle, decision, existingStatus }: { caseId:string; jobTitle:string; decision:string; existingStatus?:string|null }) {
  const [reason,setReason]=useState("");
  const [state,setState]=useState(existingStatus ?? "");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit() {
    setError("");
    if (reason.trim().length < 20) { setError("Please provide at least 20 characters."); return; }
    setBusy(true);
    const res=await fetch("/api/moderation/appeals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({caseId,reason})});
    const data=await res.json().catch(()=>({}));
    setBusy(false);
    if(!res.ok){setError(data.error ?? "Unable to submit appeal.");return;}
    setState("submitted");
  }
  if(!["restrict","escalate"].includes(decision)) return null;
  return <section className="hh-panel">
    <div className="hh-panel-heading"><div><small>APPEAL · PHASE 29</small><h2>Request a moderation review</h2></div><span>{state || "AVAILABLE"}</span></div>
    <p className="text-sm text-white/55">Job: {jobTitle}. An appeal does not bypass the restriction; it places the case into a documented review workflow.</p>
    {state ? <p className="mt-3 text-sm text-emerald-200">Appeal submitted. HiddenHire can now review the evidence and resolve the case.</p> :
      <><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} placeholder="Explain what changed, provide verification context, or identify evidence the review should consider." className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none" />
      {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
      <button disabled={busy} onClick={submit} className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50">{busy?"Submitting…":"Submit appeal"}</button></>}
  </section>;
}
