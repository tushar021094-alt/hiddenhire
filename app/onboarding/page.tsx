"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const roleSuggestions = [
  "Finance Manager",
  "Finance Analyst",
  "FP&A Manager",
  "Senior Accountant",
  "Financial Controller",
  "Business Finance",
  "Commercial Finance",
  "Accounts Manager",
];

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    headline: "",
    targetRoles: "",
    skills: "",
    experienceYears: "",
    location: "",
    country: "India",
    remoteOnly: false,
    minSalary: "",
    currency: "INR",
    jobSearchMode: "active",
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const targetRoles = form.targetRoles.split(",").map((item) => item.trim()).filter(Boolean);
    const skills = form.skills.split(",").map((item) => item.trim()).filter(Boolean);
    const preferredLocations = form.location.split(",").map((item) => item.trim()).filter(Boolean);
    const experienceYears = Number(form.experienceYears || 0);
    const minSalary = Number(form.minSalary || 0);

    if (!form.fullName.trim() || targetRoles.length === 0 || skills.length === 0) {
      setError("Please add your name, at least one target role, and at least one skill.");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: form.fullName.trim(),
        skills,
        experience_years: experienceYears,
        location: preferredLocations[0] || null,
        country: form.country,
        remote_only: form.remoteOnly,
        min_salary: minSalary,
        salary_currency: form.currency,
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { error: candidateError } = await supabase
      .from("candidate_profiles")
      .upsert({
        profile_id: user.id,
        headline: form.headline.trim() || null,
        target_roles: targetRoles,
        preferred_locations: preferredLocations,
        job_search_mode: form.jobSearchMode,
      });

    if (candidateError) {
      setError(candidateError.message);
      setSaving(false);
      return;
    }

    setMessage("Profile saved. HiddenHire can now start matching you to relevant roles.");
    setSaving(false);
    setTimeout(() => router.push("/dashboard"), 500);
  }

  return (
    <main className="min-h-screen bg-[#05080c] px-6 py-10 text-white lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <a href="/" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </a>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs text-cyan-200">
            Candidate onboarding
          </span>
        </header>

        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">AI profile setup</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Tell HiddenHire what a great next role looks like.
          </h1>
          <p className="mt-4 text-base leading-7 text-white/55">
            This profile powers your Match Radar. We use your function, skills, experience, location, remote preference and salary floor to rank relevant opportunities.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-xl font-semibold">Your profile</h2>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Full name</span>
              <input required value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="Your full name" />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Professional headline</span>
              <input value={form.headline} onChange={(e) => setField("headline", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="Finance professional | FP&A | Business Finance" />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Target roles</span>
              <input required value={form.targetRoles} onChange={(e) => setField("targetRoles", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="Finance Manager, FP&A Manager" />
              <span className="mt-2 block text-xs text-white/35">Separate multiple roles with commas.</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {roleSuggestions.map((role) => (
                  <button type="button" key={role} onClick={() => setField("targetRoles", form.targetRoles ? form.targetRoles + ", " + role : role)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55 hover:border-cyan-300/30 hover:text-cyan-200">{role}</button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Core skills</span>
              <input required value={form.skills} onChange={(e) => setField("skills", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="FP&A, Excel, forecasting, financial analysis" />
            </label>
          </section>

          <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <h2 className="text-xl font-semibold">Opportunity preferences</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/45">Experience</span>
                <input type="number" min="0" step="0.5" value={form.experienceYears} onChange={(e) => setField("experienceYears", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="6" />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/45">Minimum salary</span>
                <input type="number" min="0" value={form.minSalary} onChange={(e) => setField("minSalary", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="900000" />
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Preferred locations</span>
              <input value={form.location} onChange={(e) => setField("location", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" placeholder="Noida, Greater Noida, Delhi NCR" />
              <span className="mt-2 block text-xs text-white/35">Separate multiple locations with commas.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/45">Country</span>
                <input value={form.country} onChange={(e) => setField("country", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50" />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/45">Currency</span>
                <select value={form.currency} onChange={(e) => setField("currency", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <input type="checkbox" checked={form.remoteOnly} onChange={(e) => setField("remoteOnly", e.target.checked)} className="h-4 w-4 accent-cyan-300" />
              <span>
                <span className="block text-sm font-medium">Remote-only</span>
                <span className="mt-1 block text-xs text-white/40">Prioritize remote roles and clear physical-location constraints.</span>
              </span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/45">Job search mode</span>
              <select value={form.jobSearchMode} onChange={(e) => setField("jobSearchMode", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-300/50">
                <option value="active">Actively looking</option>
                <option value="passive">Open to the right opportunity</option>
                <option value="not_looking">Not looking right now</option>
              </select>
            </label>
          </section>

          {(error || message) && (
            <div className={`lg:col-span-2 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/30 bg-red-400/5 text-red-200" : "border-cyan-300/20 bg-cyan-300/5 text-cyan-200"}`}>
              {error || message}
            </div>
          )}

          <div className="lg:col-span-2 flex justify-end">
            <button disabled={saving} type="submit" className="rounded-xl bg-cyan-300 px-7 py-3 font-semibold text-slate-950 disabled:opacity-50">
              {saving ? "Saving profile..." : "Save profile →"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
