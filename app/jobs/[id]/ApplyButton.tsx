"use client";
import {useState} from "react";
export default function ApplyButton({jobId}:{jobId:string}){
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function apply(){setBusy(true);setMessage("");const r=await fetch("/api/jobs/"+jobId+"/apply",{method:"POST"});const d=await r.json();if(r.status===401){window.location.href="/login";return;}setMessage(r.ok?"Application submitted.":" "+(d.error||"Could not apply."));setBusy(false);}
 return <div className="mt-8"><button className="apply-button" onClick={apply} disabled={busy}>{busy?"Submitting…":"Apply via HiddenHire"} <span>→</span></button>{message&&<p className="mt-3 text-sm text-white/50">{message}</p>}</div>;
}
