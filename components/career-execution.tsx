"use client";

import { useEffect, useState } from "react";

type ExecutionPackage = {
  applicationId: string;
  mode: "application" | "follow_up" | "interview";
  role: string;
  company: string;
  location: string;
  resumeFocus: string[];
  professionalSummary: string;
  coverLetter: string;
  followUpMessage: string;
  interviewPlan: {
    opening: string;
    stories: string[];
    questions: string[];
    roleFocus: string[];
  };
  checklist: string[];
  approval: {
    required: boolean;
    submission: string;
    communication: string;
  };
};

type ApplicationOption = {
  id: string;
  status: string;
  title: string;
  company: string;
};

export default function CareerExecution() {
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [packageData, setPackageData] = useState<ExecutionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [completedChecklist, setCompletedChecklist] = useState<string[]>([]);
  const [copyNotice, setCopyNotice] = useState("");

  async function copyDraft(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(label + " copied to clipboard.");
    } catch {
      setCopyNotice("Clipboard access was blocked. Select the text and copy it manually.");
    }
  }

  async function load(applicationId = "") {
    setLoading(true);
    setError("");
    try {
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
      const response = await fetch(`/api/career-execution${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to build execution package.");
      const nextApplications = Array.isArray(data.applications) ? data.applications : [];
      setApplications(nextApplications);
      const nextPackage = data.package ?? null;
      setPackageData(nextPackage);
      if (nextPackage?.applicationId) setSelectedId(nextPackage.applicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to build execution package.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const statusLabel = packageData?.mode === "interview"
    ? "INTERVIEW PREP"
    : packageData?.mode === "follow_up"
      ? "APPLICATION FOLLOW-UP"
      : "APPLICATION PACKAGE";

  return (
    <section id="execution" className="rounded-xl border border-cyan-300/10 bg-[#071017] shadow-[0_18px_60px_rgba(0,0,0,.22)]">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">CAREER EXECUTION · PHASE 21</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Turn an application into an execution plan.</h2>
            <p className="mt-1 max-w-2xl text-[10px] leading-5 text-white/45">Tailored materials, follow-up drafts and interview preparation are generated from your actual profile signals. HiddenHire never submits or sends them for you.</p>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[.04] px-2.5 py-1 text-[9px] font-semibold text-emerald-200">APPROVAL GATED</span>
        </div>
      </div>

      {copyNotice && <p role="status" className="px-5 pt-3 text-xs text-emerald-200 sm:px-6">{copyNotice}</p>}\n\n      {applications.length > 0 && (
        <div className="border-b border-white/10 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {applications.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelectedId(item.id); void load(item.id); }}
                className={`rounded-lg border px-3 py-2 text-left text-[10px] transition ${selectedId === item.id ? "border-cyan-300/30 bg-cyan-300/[.07] text-cyan-100" : "border-white/10 bg-white/[.02] text-white/50 hover:text-white/80"}`}
              >
                <span className="block max-w-[190px] truncate font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-[9px] opacity-60">{item.company} · {item.status.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-xs text-white/35 sm:px-6">Building the execution package…</div>
      ) : error ? (
        <div className="px-5 py-8 text-xs text-amber-200">{error}</div>
      ) : !packageData ? (
        <div className="px-5 py-8 text-xs text-white/35">No application is ready for execution yet. Once you apply to a role, HiddenHire can prepare the next step.</div>
      ) : (
        <div className="grid gap-px bg-white/10 lg:grid-cols-[1.05fr_.95fr]">
          <div className="bg-[#071017] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[.18em] text-cyan-200/60">{statusLabel}</p>
                <h3 className="mt-1 text-sm font-semibold text-white">{packageData.role} · {packageData.company}</h3>
                <p className="mt-1 text-[10px] text-white/35">{packageData.location}</p>
              </div>
              <span className="rounded-md border border-white/10 px-2 py-1 text-[9px] text-white/40">READY</span>
            </div>

            <div className="mt-5">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/35">Resume focus</p>
              <div className="mt-2 space-y-1.5">{packageData.resumeFocus.map((item) => <p key={item} className="text-[10px] leading-5 text-white/60">• {item}</p>)}</div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-200/60">Tailored summary</p>
              <p className="mt-2 text-[10px] leading-5 text-white/65">{packageData.professionalSummary}</p>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-white/35">Submission checklist</p>
              <div className="mt-2 space-y-2">{packageData.checklist.map((item) => <label key={item} className="flex cursor-pointer items-start gap-2 text-[10px] leading-5 text-white/60"><input type="checkbox" checked={completedChecklist.includes(item)} onChange={(event) => setCompletedChecklist((current) => event.target.checked ? [...current, item] : current.filter((entry) => entry !== item))} className="mt-1 accent-cyan-300" /><span className={completedChecklist.includes(item) ? "text-white/35 line-through" : ""}>{item}</span></label>)}<p className="text-[9px] text-white/35">{completedChecklist.length} of {packageData.checklist.length} completed</p></div>
            </div>
          </div>

          <div className="bg-[#071017] p-5 sm:p-6">
            <div className="rounded-lg border border-cyan-300/10 bg-cyan-300/[.03] p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-cyan-200/60">Cover-letter draft</p>
              <textarea aria-label="Editable cover-letter draft" value={coverLetterDraft} onChange={(event) => setCoverLetterDraft(event.target.value)} rows={10} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/80 outline-none focus:border-cyan-300/40" /><button type="button" onClick={() => void copyDraft(coverLetterDraft, "Cover letter")} className="mt-2 rounded-lg border border-cyan-300/20 px-3 py-2 text-[10px] text-cyan-100">Copy cover letter</button>
            </div>

            <div className="mt-4 rounded-lg border border-amber-300/10 bg-amber-300/[.03] p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-amber-200/60">Recruiter follow-up draft</p>
              <textarea aria-label="Editable recruiter follow-up draft" value={followUpDraft} onChange={(event) => setFollowUpDraft(event.target.value)} rows={8} className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/80 outline-none focus:border-amber-300/40" /><button type="button" onClick={() => void copyDraft(followUpDraft, "Recruiter follow-up")} className="mt-2 rounded-lg border border-amber-300/20 px-3 py-2 text-[10px] text-amber-100">Copy follow-up</button>
            </div>

            <div className="mt-4 rounded-lg border border-violet-300/10 bg-violet-300/[.03] p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-violet-200/60">Interview preparation</p>
              <p className="mt-2 text-[10px] leading-5 text-white/60">{packageData.interviewPlan.opening}</p>
              <div className="mt-2 space-y-1.5">{packageData.interviewPlan.stories.map((item) => <p key={item} className="text-[10px] leading-5 text-white/55">• {item}</p>)}</div>
              <p className="mt-3 text-[9px] font-semibold uppercase tracking-[.15em] text-white/30">Questions to ask</p>
              <div className="mt-1.5 space-y-1.5">{packageData.interviewPlan.questions.map((item) => <p key={item} className="text-[10px] leading-5 text-white/55">• {item}</p>)}</div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-300/10 bg-emerald-300/[.03] p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-emerald-200/60">Human approval gate</p>
              <p className="mt-2 text-[10px] leading-5 text-white/60">{packageData.approval.submission}</p>
              <p className="mt-1 text-[10px] leading-5 text-white/60">{packageData.approval.communication}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
