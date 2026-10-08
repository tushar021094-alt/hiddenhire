"use client";

import { useMemo, useState } from "react";
import { buildRecruiterOutreachPackage } from "@/lib/recruiter-outreach";

export default function RecruiterOutreachCard({ candidate, jobTitle, companyName }: { candidate: any; jobTitle: string; companyName?: string | null }) {
  const [open, setOpen] = useState(false);
  const pkg = useMemo(() => buildRecruiterOutreachPackage({
    candidateName: candidate.name,
    jobTitle,
    companyName,
    candidateSkills: candidate.skills,
    intelligence: {
      priority: candidate.recruiterPriority,
      recruiterScore: candidate.recruiterScore,
      fitScore: candidate.score,
      readinessScore: candidate.readinessScore,
      confidence: candidate.recruiterConfidence,
      reasons: candidate.reasons ?? [],
      nextAction: candidate.nextAction,
    }
  }), [candidate, jobTitle, companyName]);

  if (candidate.recruiterPriority !== "strong" && candidate.recruiterPriority !== "promising") return null;

  return <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">AI outreach preparation</div>
        <div className="mt-1 text-sm text-white/70">Evidence-based draft · approval required</div>
      </div>
      <button onClick={() => setOpen(!open)} className="hh-btn-secondary text-xs">{open ? "Hide draft" : "Prepare outreach"}</button>
    </div>
    {open && <div className="mt-4 space-y-3">
      <div className="text-sm font-medium text-white">{pkg.subject}</div>
      <pre className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-5 text-white/70">{pkg.message}</pre>
      <div className="text-[11px] text-amber-200/70">HiddenHire prepares the message only. Recruiter approval is required before sending.</div>
    </div>}
  </div>;
}
