"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HiddenHireLogo from "@/components/hiddenhire-logo";
import { canonicalCountryName, COUNTRY_OPTIONS, isCountryName, LOCATION_SUGGESTIONS } from "@/lib/countries";

type EducationItem = { qualification: string; institution: string | null; year: string | null };
type WorkExperienceItem = { title: string | null; company: string | null; startDate: string | null; endDate: string | null; summary: string | null };
type SalaryRecommendation = {
  minimumAnnual: number | null;
  maximumAnnual: number | null;
  currency: string;
  rationale: string | null;
  confidence: "low" | "medium" | "high";
};
type StoredResumeDetails = {
  resumeSummary: string | null;
  education: EducationItem[];
  workExperience: WorkExperienceItem[];
  certifications: string[];
  recommendedTargetRoles: string[];
  salaryRecommendation: SalaryRecommendation | null;
};
type ResumeDraft = {
  fullName: string | null;
  headline: string | null;
  targetRole: string | null;
  recommendedTargetRoles: string[];
  skills: string[];
  experienceYears: number | null;
  country: string | null;
  resumeSummary: string | null;
  education: EducationItem[];
  workExperience: WorkExperienceItem[];
  certifications: string[];
  missingFields: string[];
  salaryRecommendation: SalaryRecommendation | null;
};

function parsePreferredLocations(value: unknown, primaryCountry: string): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];
  const primary = primaryCountry.trim().toLocaleLowerCase();
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 100))
    .filter((item) => item && !isCountryName(item) && item.toLocaleLowerCase() !== primary))].slice(0, 15);
}

type ProfileData = {
  profile?: {
    full_name?: string | null;
    skills?: string[] | null;
    experience_years?: number | null;
    country?: string | null;
    remote_only?: boolean | null;
    min_salary?: number | null;
    salary_currency?: string | null;
  };
  career?: {
    target_roles?: string[] | null;
    preferred_locations?: string[] | null;
    headline?: string | null;
    education?: EducationItem[] | null;
    work_experience?: WorkExperienceItem[] | null;
    certifications?: string[] | null;
    resume_summary?: string | null;
    recommended_target_roles?: string[] | null;
    suggested_salary_min?: number | null;
    suggested_salary_max?: number | null;
    suggested_salary_currency?: string | null;
    salary_recommendation_rationale?: string | null;
    salary_recommendation_confidence?: "low" | "medium" | "high" | null;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [country, setCountry] = useState("India");
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [locationDraft, setLocationDraft] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minSalary, setMinSalary] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeSaving, setResumeSaving] = useState(false);
  const [resumeSaved, setResumeSaved] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);
  const [savedResumeDetails, setSavedResumeDetails] = useState<StoredResumeDetails | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/profile");
      const data = await response.json() as ProfileData & { error?: string };
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.ok) {
        setFullName(data.profile?.full_name || "");
        const career = data.career;
        const savedSalaryMinimum = career?.suggested_salary_min;
        const savedSalaryMaximum = career?.suggested_salary_max;
        const savedSalaryCurrency = career?.suggested_salary_currency || "INR";
        const hasSavedSalarySuggestion = typeof savedSalaryMinimum === "number" || typeof savedSalaryMaximum === "number";
        const savedSalaryRecommendation: SalaryRecommendation | null = hasSavedSalarySuggestion ? {
          minimumAnnual: typeof savedSalaryMinimum === "number" ? savedSalaryMinimum : null,
          maximumAnnual: typeof savedSalaryMaximum === "number" ? savedSalaryMaximum : null,
          currency: savedSalaryCurrency,
          rationale: career?.salary_recommendation_rationale || null,
          confidence: career?.salary_recommendation_confidence || "low",
        } : null;
        const education = Array.isArray(career?.education) ? career.education : [];
        const workExperience = Array.isArray(career?.work_experience) ? career.work_experience : [];
        const certifications = Array.isArray(career?.certifications) ? career.certifications : [];
        const recommendedTargetRoles = Array.isArray(career?.recommended_target_roles) ? career.recommended_target_roles : [];
        const resumeSummary = career?.resume_summary || null;
        const loadedCountry = canonicalCountryName(data.profile?.country || "India") || "India";
        setCountry(loadedCountry);
        const loadedPreferredLocations = parsePreferredLocations(career?.preferred_locations, loadedCountry);
        setPreferredLocations(loadedPreferredLocations);
        if (resumeSummary || education.length || workExperience.length || certifications.length || recommendedTargetRoles.length || savedSalaryRecommendation) {
          setSavedResumeDetails({ resumeSummary, education, workExperience, certifications, recommendedTargetRoles, salaryRecommendation: savedSalaryRecommendation });
        }
        setRole(data.career?.target_roles?.[0] || "");
        setHeadline(data.career?.headline || "");
        setSkills((data.profile?.skills || []).join(", "));
        setExperience(data.profile?.experience_years == null ? "" : String(data.profile.experience_years));
        setRemoteOnly(Boolean(data.profile?.remote_only));
        setMinSalary(String(data.profile?.min_salary ?? 0));
        setCurrency(data.profile?.salary_currency || "INR");
      } else {
        setMessage(data.error || "Unable to load profile.");
      }
      setLoading(false);
    })();
  }, [router]);

  function addPreferredLocation(value = locationDraft) {
    const additions = parsePreferredLocations(value, country);
    if (!additions.length) {
      setMessage("Choose a city or region, not a country name, for Preferred locations.");
      return;
    }
    setPreferredLocations((current) => parsePreferredLocations([...current, ...additions], country));
    setLocationDraft("");
    setMessage("");
  }

  function removePreferredLocation(value: string) {
    setPreferredLocations((current) => current.filter((location) => location !== value));
  }

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
    setResumeSaved(false);
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

  async function applyResumeDraft() {
    if (!resumeDraft) return;
    const recommendedRole = resumeDraft.recommendedTargetRoles[0] || resumeDraft.targetRole || role.trim();
    if (!recommendedRole) {
      setResumeMessage("The resume did not identify a confident target role. Enter a target role above before saving the extracted details.");
      return;
    }

    const nextFullName = resumeDraft.fullName || fullName;
    const nextHeadline = resumeDraft.headline || headline;
    const nextSkills = resumeDraft.skills.length ? resumeDraft.skills : skills.split(",").map((item) => item.trim()).filter(Boolean);
    const nextExperience = resumeDraft.experienceYears ?? (experience.trim() ? Number(experience) : 0);
    const nextCountry = canonicalCountryName(resumeDraft.country || country) || country || "India";
    const nextCurrency = resumeDraft.salaryRecommendation?.currency || currency;
    const nextMinimumSalary = resumeDraft.salaryRecommendation?.minimumAnnual ?? (minSalary.trim() ? Number(minSalary) : 0);

    setResumeSaving(true);
    setResumeMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: nextFullName,
          role: recommendedRole,
          headline: nextHeadline,
          skills: nextSkills,
          experience: nextExperience,
          country: nextCountry,
          preferredLocations,
          remoteOnly,
          minSalary: nextMinimumSalary,
          salaryCurrency: nextCurrency,
          resumeDetails: {
            summary: resumeDraft.resumeSummary,
            education: resumeDraft.education,
            workExperience: resumeDraft.workExperience,
            certifications: resumeDraft.certifications,
          },
          recommendedTargetRoles: resumeDraft.recommendedTargetRoles.length
            ? resumeDraft.recommendedTargetRoles
            : [recommendedRole],
          salaryRecommendation: resumeDraft.salaryRecommendation,
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save extracted resume details.");

      setFullName(nextFullName);
      setRole(recommendedRole);
      setHeadline(nextHeadline);
      setSkills(nextSkills.join(", "));
      setExperience(String(nextExperience));
      setCountry(nextCountry);
      setCurrency(nextCurrency);
      setMinSalary(String(nextMinimumSalary));
      setSavedResumeDetails({
        resumeSummary: resumeDraft.resumeSummary,
        education: resumeDraft.education,
        workExperience: resumeDraft.workExperience,
        certifications: resumeDraft.certifications,
        recommendedTargetRoles: resumeDraft.recommendedTargetRoles.length ? resumeDraft.recommendedTargetRoles : [recommendedRole],
        salaryRecommendation: resumeDraft.salaryRecommendation,
      });
      setResumeSaved(true);
      setMessage("Career profile and extracted resume details saved.");
      setResumeMessage("Resume details, target-role suggestions, and salary recommendation have been saved. The salary range is an estimate, not live-market salary data.");
    } catch (err) {
      setResumeMessage(err instanceof Error ? err.message : "Could not save the extracted resume details.");
    } finally {
      setResumeSaving(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          headline,
          skills: skills.split(",").map((v) => v.trim()).filter(Boolean),
          experience: Number(experience),
          country,
          preferredLocations,
          remoteOnly,
          minSalary: Number(minSalary),
          salaryCurrency: currency,
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      setMessage(response.ok
        ? "Career profile saved. Your latest preferences are now stored."
        : (data.error || "Unable to save profile."));
    } catch {
      setMessage("Network error while saving. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
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
              <p>Upload a PDF to extract your career details, suggest target roles and estimate a salary range. Review the results, then save supported profile fields in one action.</p>
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
            <div className="resume-review-heading"><h3>Review extracted details</h3><span>{resumeSaved ? "Saved to profile" : "Not saved yet"}</span></div>
            <p><strong>Name:</strong> {resumeDraft.fullName || "Not found"} <span className="resume-muted">· will update your profile name when saved</span></p>
            <p><strong>Best-fit target role:</strong> {resumeDraft.recommendedTargetRoles[0] || resumeDraft.targetRole || "Not confidently detected"}</p>
            {resumeDraft.recommendedTargetRoles.length > 0 && <p><strong>Alternative role targets:</strong> {resumeDraft.recommendedTargetRoles.join(", ")}</p>}
            <p><strong>Headline:</strong> {resumeDraft.headline || "Not found"}</p>
            <p><strong>Experience:</strong> {resumeDraft.experienceYears === null ? "Not confidently detected" : `${resumeDraft.experienceYears} years`}</p>
            <p><strong>Country:</strong> {resumeDraft.country || "Not found"}</p>
            <p><strong>Skills:</strong> {resumeDraft.skills.length ? resumeDraft.skills.join(", ") : "No skills detected"}</p>
            {resumeDraft.resumeSummary && <p><strong>Resume summary:</strong> {resumeDraft.resumeSummary}</p>}
            {resumeDraft.salaryRecommendation && <div className="resume-import-message">
              <strong>Indicative annual salary range:</strong>{" "}
              {resumeDraft.salaryRecommendation.currency}{" "}
              {resumeDraft.salaryRecommendation.minimumAnnual === null ? "—" : resumeDraft.salaryRecommendation.minimumAnnual.toLocaleString()}{" "}
              –{" "}
              {resumeDraft.salaryRecommendation.maximumAnnual === null ? "—" : resumeDraft.salaryRecommendation.maximumAnnual.toLocaleString()}
              <p>{resumeDraft.salaryRecommendation.rationale || "Based on the resume's role and experience signals."}</p>
              <p className="resume-muted">Confidence: {resumeDraft.salaryRecommendation.confidence}. AI estimate only—not a live-market salary survey or guaranteed offer.</p>
            </div>}
            {resumeDraft.workExperience.length > 0 && <div><strong>Work history preview</strong>{resumeDraft.workExperience.map((item, index) => <p key={index}>{item.title || "Role not identified"}{item.company ? ` · ${item.company}` : ""}{item.startDate || item.endDate ? ` · ${item.startDate || "?"}–${item.endDate || "?"}` : ""}{item.summary ? <span className="resume-muted"> — {item.summary}</span> : null}</p>)}</div>}
            {resumeDraft.education.length > 0 && <div><strong>Education preview</strong>{resumeDraft.education.map((item, index) => <p key={index}>{item.qualification}{item.institution ? ` · ${item.institution}` : ""}{item.year ? ` · ${item.year}` : ""}</p>)}</div>}
            {resumeDraft.certifications.length > 0 && <p><strong>Certifications:</strong> {resumeDraft.certifications.join(", ")}</p>}
            {resumeDraft.missingFields.length > 0 && <p className="resume-muted"><strong>Check manually:</strong> {resumeDraft.missingFields.join(", ")}</p>}
            <button type="button" onClick={applyResumeDraft} disabled={resumeSaving || resumeSaved} className="workspace-primary-button">
              {resumeSaving ? "Saving resume profile…" : resumeSaved ? "Saved to profile ✓" : "Apply suggestions & save profile →"}
            </button>
          </div>}
          {!resumeDraft && savedResumeDetails && <div className="resume-review">
            <div className="resume-review-heading"><h3>Resume details on file</h3><span>Saved</span></div>
            {savedResumeDetails.resumeSummary && <p><strong>Summary:</strong> {savedResumeDetails.resumeSummary}</p>}
            {savedResumeDetails.recommendedTargetRoles.length > 0 && <p><strong>AI role suggestions:</strong> {savedResumeDetails.recommendedTargetRoles.join(", ")}</p>}
            {savedResumeDetails.salaryRecommendation && <p><strong>Indicative salary range:</strong> {savedResumeDetails.salaryRecommendation.currency} {savedResumeDetails.salaryRecommendation.minimumAnnual?.toLocaleString() || "—"} – {savedResumeDetails.salaryRecommendation.maximumAnnual?.toLocaleString() || "—"} per year <span className="resume-muted">(AI estimate, not live-market data)</span></p>}
            {savedResumeDetails.workExperience.length > 0 && <div><strong>Work history</strong>{savedResumeDetails.workExperience.map((item, index) => <p key={index}>{item.title || "Role not identified"}{item.company ? ` · ${item.company}` : ""}{item.startDate || item.endDate ? ` · ${item.startDate || "?"}–${item.endDate || "?"}` : ""}{item.summary ? <span className="resume-muted"> — {item.summary}</span> : null}</p>)}</div>}
            {savedResumeDetails.education.length > 0 && <div><strong>Education</strong>{savedResumeDetails.education.map((item, index) => <p key={index}>{item.qualification}{item.institution ? ` · ${item.institution}` : ""}{item.year ? ` · ${item.year}` : ""}</p>)}</div>}
            {savedResumeDetails.certifications.length > 0 && <p><strong>Certifications:</strong> {savedResumeDetails.certifications.join(", ")}</p>}
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
                <input required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Finance Executive" />
              </Field>
              <Field label="Professional headline" hint="A concise positioning statement">
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Finance professional focused on FP&A…" />
              </Field>
              <Field label="Skills" hint="Separate skills with commas" wide>
                <input value={skills} onChange={(e) => setSkills(e.target.value)} />
              </Field>
            </div>
            <p className="profile-target-role-guidance">
              <strong>Plan your next move:</strong> Target role is the position you want next and is used to rank jobs. Your headline and skills should describe your current responsibilities and strengths. They do not need to match the target role.
            </p>
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
              <Field label="Country" hint="Primary market · searchable global list">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setPreferredLocations([]);
                    setLocationDraft("");
                  }}
                  aria-label="Primary country"
                >
                  <option value="">Select a country</option>
                  {COUNTRY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <div className="profile-field profile-field-wide">
                <span id="preferred-locations-label">Preferred locations</span>
                <small id="preferred-locations-help">Choose multiple cities or regions for {country || "your selected country"}. Leave empty to search across the whole country.</small>
                <div className="profile-location-picker" aria-describedby="preferred-locations-help">
                  {preferredLocations.length > 0 ? (
                    <div className="profile-location-selected-list" aria-label="Selected locations">
                      {preferredLocations.map((location) => (
                        <span className="profile-location-chip" key={location}>
                          {location}
                          <button type="button" onClick={() => removePreferredLocation(location)} aria-label={`Remove ${location}`}>×</button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="profile-location-empty">No location restrictions selected.</p>
                  )}
                  <div className="profile-location-add-row">
                    <input
                      id="preferred-location-draft"
                      value={locationDraft}
                      onChange={(e) => setLocationDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPreferredLocation();
                        }
                      }}
                      placeholder="Type a city or state, then Add"
                      aria-labelledby="preferred-locations-label"
                    />
                    <button type="button" className="profile-location-add-button" onClick={() => addPreferredLocation()}>Add</button>
                  </div>
                  {(LOCATION_SUGGESTIONS[country] || []).filter((location) => !preferredLocations.includes(location)).length > 0 && (
                    <div className="profile-location-suggestions">
                      <small>Popular in {country}</small>
                      <div>
                        {(LOCATION_SUGGESTIONS[country] || []).filter((location) => !preferredLocations.includes(location)).map((location) => (
                          <button type="button" key={location} onClick={() => addPreferredLocation(location)}>+ {location}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
