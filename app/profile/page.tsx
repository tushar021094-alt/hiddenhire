"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
            <Link href="/dashboard" className="workspace-brand">
              Hidden<span>Hire</span>
            </Link>
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
