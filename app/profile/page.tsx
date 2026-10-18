"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HiddenHireLogo from "@/components/hiddenhire-logo";

type ResumeDraft = {
  fullName: string | null;
  headline: string | null;
  targetRole: string | null;
  skills: string[];
  experienceYears: number | null;
  country: string | null;
  education: Array<{ qualification: string; institution: string | null; year: string | null }>;
  workExperience: Array<{ title: string | null; company: string | null; startDate: string | null; endDate: string | null; summary: string | null }>;
  certifications: string[];
  missingFields: string[];
};

type ProfileData = {
  profile?: {
    skills?: string[] | null;
    experience_years?: number | null;
    country?: string | null;
    remote_only?: boolean | null;
    min_salary?: number | null;
    salary_currency?: string | null;
  };
  career?: { target_roles?: string[] | null; headline?: string | null };
};

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState("Finance Manager");
  const [headline, setHeadline] = useState("");
  const [skills, setSkills] = useState("FP&A, financial analysis, forecasting, Excel");
  const [experience, setExperience] = useState("6");
  const [country, setCountry] = useState("India");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minSalary, setMinSalary] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/profile");
      const data = await response.json() as ProfileData & { error?: string };
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.ok) {
        setRole(data.career?.target_roles?.[0] || "Finance Manager");
        setHeadline(data.career?.headline || "");
        setSkills((data.profile?.skills || []).join(", ") || "FP&A, financial analysis, forecasting, Excel");
        setExperience(String(data.profile?.experience_years ?? 6));
        setCountry(data.profile?.country || "India");
        setRemoteOnly(Boolean(data.profile?.remote_only));
        setMinSalary(String(data.profile?.min_salary ?? 0));
        setCurrency(data.profile?.salary_currency || "INR");
      } else {
        setMessage(data.error || "Unable to load profile.");
      }
      setLoading(false);
    })();
  }, [router]);

  async function importResume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("resume") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setResumeMessage("Choose a PDF resume first.");
      return;
    }
    setResumeBusy(true);
    setResumeMessage("");
    setResumeDraft(null);
    try {
      const payload = new FormData();
      payload.append("resume", file);
      const response = await fetch("/api/profile/resume", { method: "POST", body: payload });
      const data = await response.json() as { draft?: ResumeDraft; error?: string; notice?: string };
      if (!response.ok || !data.draft) {
        setResumeMessage(data.error || "Unable to read this resume.");
        return;
      }
      setResumeDraft(data.draft);
      setResumeMessage(data.notice || "Review the extracted details below, then choose which ones to apply.");
    } catch {
      setResumeMessage("Resume import failed. Your saved profile has not changed.");
    } finally {
      setResumeBusy(false);
    }
  }

  function applyResumeDraft() {
    if (!resumeDraft) return;
    if (resumeDraft.targetRole) setRole(resumeDraft.targetRole);
    if (resumeDraft.headline) setHeadline(resumeDraft.headline);
    if (resumeDraft.skills.length) setSkills(resumeDraft.skills.join(", "));
    if (resumeDraft.experienceYears !== null) setExperience(String(resumeDraft.experienceYears));
    if (resumeDraft.country) setCountry(resumeDraft.country);
    setResumeMessage("Draft applied to the editable form. Review it and select Save career profile to persist supported fields.");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        headline,
        skills: skills.split(",").map((v) => v.trim()).filter(Boolean),
        experience: Number(experience),
        country,
        remoteOnly,
        minSalary: Number(minSalary),
        salaryCurrency: currency,
      }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? "Career profile saved. Matching is now using your latest preferences." : (data.error || "Unable to save profile."));
    setSaving(false);
    if (response.ok) setTimeout(() => router.push("/dashboard"), 500);
  }

  if (loading) {
    return (
      <main className="app-v2 profile-v2 min-h-screen">
        <div className="workspace-shell">
          <div className="workspace-state profile-loading">Loading your career profile…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-v2 profile-v2 min-h-screen">
      <div className="workspace-shell">
        <header className="workspace-header">
          <div className="workspace-brand-row">
            <HiddenHireLogo className="workspace-brand-logo" />
            <nav className="workspace-nav" aria-label="Candidate navigation">
              <Link href="/dashboard">Overview</Link>
              <Link href="/jobs">Discover</Link>
              <Link href="/applications">Applications</Link>
              <Link href="/profile" className="is-active">Profile</Link>
            </nav>
          </div>
          <Link href="/jobs" className="workspace-header-action">Back to matches <span>↗</span></Link>
        </header>

        <section className="workspace-hero profile-hero">
          <div>
            <span className="workspace-eyebrow">Career profile</span>
            <h1>Teach HiddenHire what you want next.</h1>
            <p>Your profile is the signal behind every match. Keep your target role, skills, location and compensation preferences current.</p>
          </div>
          <div className="profile-signal-card">
            <span>Matching signal</span>
            <strong>{role || "Target role not set"}</strong>
            <small>{remoteOnly ? "Remote-first search" : `${country || "India"} · Location flexible`}</small>
          </div>
        </section>

        <section className="profile-form-card resume-import-card">
          <div className="profile-section-heading">
            <div>
              <span>OPTIONAL · AI ASSISTED SETUP</span>
              <h2>Auto-fill with your resume</h2>
              <p>Upload a PDF and HiddenHire will extract profile details for your review. Nothing is saved until you approve and save the form.</p>
            </div>
            <span className="profile-live-badge">AI IMPORT</span>
          </div>
          <form onSubmit={importResume} className="resume-import-controls">
            <label className="resume-file-field">
              <span>Resume PDF · up to 5 MB</span>
              <input name="resume" type="file" accept="application/pdf,.pdf" />
            </label>
            <button type="submit" disabled={resumeBusy} className="workspace-primary-button">
              {resumeBusy ? "Analyzing resume…" : "Upload & extract →"}
            </button>
          </form>
          {resumeMessage && <p role="status" className={resumeDraft ? "resume-import-message is-success" : "resume-import-message"}>{resumeMessage}</p>}
          {resumeDraft && <div className="resume-review">
            <div className="resume-review-heading"><h3>Review extracted details</h3><span>Not saved yet</span></div>
            <p><strong>Name:</strong> {resumeDraft.fullName || "Not found"} <span className="resume-muted">· name is shown for reference and is not changed by this form</span></p>
            <p><strong>Target role:</strong> {resumeDraft.targetRole || "Not found"}</p>
            <p><strong>Headline:</strong> {resumeDraft.headline || "Not found"}</p>
            <p><strong>Experience:</strong> {resumeDraft.experienceYears === null ? "Not confidently detected" : `${resumeDraft.experienceYears} years`}</p>
            <p><strong>Country:</strong> {resumeDraft.country || "Not found"}</p>
            <p><strong>Skills:</strong> {resumeDraft.skills.length ? resumeDraft.skills.join(", ") : "No skills detected"}</p>
            {resumeDraft.workExperience.length > 0 && <div><strong>Work history preview</strong>{resumeDraft.workExperience.map((item, index) => <p key={index}>{item.title || "Role not identified"}{item.company ? ` · ${item.company}` : ""}{item.startDate || item.endDate ? ` · ${item.startDate || "?"}–${item.endDate || "?"}` : ""}{item.summary ? <span className="resume-muted"> — {item.summary}</span> : null}</p>)}</div>}
            {resumeDraft.education.length > 0 && <div><strong>Education preview</strong>{resumeDraft.education.map((item, index) => <p key={index}>{item.qualification}{item.institution ? ` · ${item.institution}` : ""}{item.year ? ` · ${item.year}` : ""}</p>)}</div>}
            {resumeDraft.certifications.length > 0 && <p><strong>Certifications:</strong> {resumeDraft.certifications.join(", ")}</p>}
            {resumeDraft.missingFields.length > 0 && <p className="resume-muted"><strong>Check manually:</strong> {resumeDraft.missingFields.join(", ")}</p>}
            <button type="button" onClick={applyResumeDraft} className="workspace-secondary-button">Apply extracted fields to form</button>
          </div>}
        </section>

        <form onSubmit={save} className="profile-layout">
          <section className="profile-form-card">
            <div className="profile-section-heading">
              <div>
                <span>01 · Career direction</span>
                <h2>What should HiddenHire optimize for?</h2>
              </div>
              <span className="profile-live-badge">Live matching</span>
            </div>

            <div className="profile-field-grid">
              <Field label="Target role" hint="Primary role used for ranking">
                <input required value={role} onChange={(e) => setRole(e.target.value)} />
              </Field>
              <Field label="Professional headline" hint="A concise positioning statement">
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Finance professional focused on FP&A…" />
              </Field>
              <Field label="Skills" hint="Separate skills with commas" wide>
                <input value={skills} onChange={(e) => setSkills(e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="profile-form-card">
            <div className="profile-section-heading">
              <div>
                <span>02 · Search preferences</span>
                <h2>Set the boundaries for your search.</h2>
              </div>
            </div>

            <div className="profile-field-grid">
              <Field label="Experience" hint="Years of professional experience">
                <div className="profile-input-suffix">
                  <input type="number" min="0" max="60" value={experience} onChange={(e) => setExperience(e.target.value)} />
                  <span>years</span>
                </div>
              </Field>
              <Field label="Country" hint="Primary market">
                <input value={country} onChange={(e) => setCountry(e.target.value)} />
              </Field>
              <Field label="Minimum salary" hint="Your compensation floor">
                <div className="profile-input-suffix">
                  <input type="number" min="0" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Salary currency">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </Field>
              <label className={`profile-preference-toggle ${remoteOnly ? "is-on" : ""}`}>
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                <span className="profile-toggle-ui" />
                <span>
                  <strong>Remote-only</strong>
                  <small>Only prioritize remote opportunities.</small>
                </span>
              </label>
            </div>
          </section>

          {message && (
            <div className={`profile-message ${message.startsWith("Career profile saved") ? "is-success" : "is-error"}`}>
              {message}
            </div>
          )}

          <div className="profile-form-footer">
            <Link href="/dashboard" className="workspace-secondary-button">Cancel</Link>
            <button disabled={saving} className="workspace-primary-button">
              {saving ? "Saving profile…" : "Save career profile →"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`profile-field ${wide ? "profile-field-wide" : ""}`}>
      <span>{label}</span>
      <small>{hint}</small>
      <div>{children}</div>
    </label>
  );
}
