"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProfileData = {
  profile?: { skills?: string[] | null; experience_years?: number | null; country?: string | null; remote_only?: boolean | null; min_salary?: number | null; salary_currency?: string | null };
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
      if (response.status === 401) { router.replace("/login"); return; }
      if (response.ok) {
        setRole(data.career?.target_roles?.[0] || "Finance Manager");
        setHeadline(data.career?.headline || "");
        setSkills((data.profile?.skills || []).join(", ") || "FP&A, financial analysis, forecasting, Excel");
        setExperience(String(data.profile?.experience_years ?? 6));
        setCountry(data.profile?.country || "India");
        setRemoteOnly(Boolean(data.profile?.remote_only));
        setMinSalary(String(data.profile?.min_salary ?? 0));
        setCurrency(data.profile?.salary_currency || "INR");
      } else setMessage(data.error || "Unable to load profile.");
      setLoading(false);
    })();
  }, [router]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, headline, skills: skills.split(",").map(v => v.trim()).filter(Boolean), experience: Number(experience), country, remoteOnly, minSalary: Number(minSalary), salaryCurrency: currency }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? "Career profile saved. Matching is now using your latest preferences." : (data.error || "Unable to save profile."));
    setSaving(false);
    if (response.ok) setTimeout(() => router.push("/dashboard"), 500);
  }

  if (loading) return <main className="min-h-screen px-5 py-10 text-white"><div className="mx-auto max-w-3xl pt-20 text-white/50">Loading your profile…</div></main>;

  return <main className="app-v2 min-h-screen px-5 py-10 text-slate-900 sm:px-8"><div className="mx-auto max-w-3xl pt-10">
    <a href="/dashboard" className="text-sm text-cyan-300">← Dashboard</a>
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <div className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Career profile</div>
      <h1 className="mt-3 text-3xl font-semibold">Teach HiddenHire what you want next.</h1>
      <p className="mt-2 text-sm text-white/45">These preferences drive relevance, location, compensation and recruiter matching.</p>
      <form onSubmit={save} className="mt-7 grid gap-5 md:grid-cols-2">
        <Field label="Target role"><input required value={role} onChange={e => setRole(e.target.value)} /></Field>
        <Field label="Headline"><input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Finance professional focused on FP&A…" /></Field>
        <Field label="Skills"><input value={skills} onChange={e => setSkills(e.target.value)} /></Field>
        <Field label="Experience (years)"><input type="number" min="0" max="60" value={experience} onChange={e => setExperience(e.target.value)} /></Field>
        <Field label="Country"><input value={country} onChange={e => setCountry(e.target.value)} /></Field>
        <Field label="Minimum salary"><input type="number" min="0" value={minSalary} onChange={e => setMinSalary(e.target.value)} /></Field>
        <Field label="Currency"><select value={currency} onChange={e => setCurrency(e.target.value)}><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></Field>
        <label className="flex items-center gap-3 text-sm text-white/65 md:mt-6"><input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} />Remote-only preference</label>
        {message && <p className="text-sm text-white/60 md:col-span-2">{message}</p>}
        <button disabled={saving} className="rounded-xl bg-white px-5 py-3 font-semibold text-black md:col-span-2">{saving ? "Saving…" : "Save career profile →"}</button>
      </form>
    </div>
  </div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-[.12em] text-white/40">{label}<div className="mt-2">{children}</div></label>;
}
