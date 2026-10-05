"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

const cityOptions = [
  "Ahmedabad", "Bengaluru", "Bhopal", "Bhubaneswar", "Chandigarh", "Chennai",
  "Coimbatore", "Dehradun", "Delhi", "Faridabad", "Ghaziabad", "Goa",
  "Gurugram", "Guwahati", "Hyderabad", "Indore", "Jaipur", "Kanpur",
  "Kochi", "Kolkata", "Lucknow", "Ludhiana", "Mohali", "Mumbai", "Mysuru",
  "Nagpur", "Noida", "Patna", "Pune", "Ranchi", "Surat", "Thane",
  "Thiruvananthapuram", "Vadodara", "Varanasi", "Visakhapatnam",
];

const headlineRoleRules: Array<{ keywords: string[]; roles: string[] }> = [
  { keywords: ["fp&a", "financial planning", "planning and analysis", "financial planning and analysis"], roles: ["FP&A Manager", "Finance Manager", "Finance Analyst", "Business Finance"] },
  { keywords: ["controller", "controllership"], roles: ["Financial Controller", "Finance Manager", "Accounts Manager", "Senior Accountant"] },
  { keywords: ["accounting", "accountant", "accounts"], roles: ["Senior Accountant", "Accounts Manager", "Finance Manager", "Financial Controller"] },
  { keywords: ["commercial finance", "commercial"], roles: ["Commercial Finance", "Finance Manager", "Business Finance", "Finance Analyst"] },
  { keywords: ["business finance", "business finance"], roles: ["Business Finance", "Finance Manager", "FP&A Manager", "Finance Analyst"] },
  { keywords: ["treasury"], roles: ["Treasury Manager", "Finance Manager", "Finance Analyst"] },
  { keywords: ["tax", "taxation"], roles: ["Tax Manager", "Finance Manager", "Senior Accountant"] },
  { keywords: ["audit", "auditor"], roles: ["Internal Audit Manager", "Finance Manager", "Financial Controller"] },
  { keywords: ["finance", "financial"], roles: ["Finance Manager", "FP&A Manager", "Finance Analyst", "Business Finance", "Commercial Finance", "Financial Controller"] },
];

function suggestedRolesForHeadline(headline: string) {
  const text = headline.toLowerCase().trim();
  if (!text) return roleSuggestions.slice(0, 4);

  const matches = headlineRoleRules
    .filter((rule) => rule.keywords.some((keyword) => text.includes(keyword)))
    .flatMap((rule) => rule.roles);

  return [...new Set(matches)].slice(0, 6);
}

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    headline: "",
    targetRoles: "",
    skills: "",
    experienceYears: "",
    location: [] as string[],
    country: "India",
    remoteOnly: false,
    minSalary: "",
    currency: "INR",
    jobSearchMode: "active",
  });

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
      }
    }

    void checkAuth();
  }, [router]);

  const suggestedRoles = useMemo(() => suggestedRolesForHeadline(form.headline), [form.headline]);

  function handleHeadlineChange(value: string) {
    setForm((current) => ({
      ...current,
      headline: value,
      targetRoles: current.targetRoles.trim()
        ? current.targetRoles
        : suggestedRolesForHeadline(value).slice(0, 3).join(", "),
    }));
  }

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleLocation(city: string) {
    setForm((current) => ({
      ...current,
      location: current.location.includes(city)
        ? current.location.filter((item) => item !== city)
        : [...current.location, city],
    }));
  }

  function addRole(role: string) {
    const roles = form.targetRoles.split(",").map((item) => item.trim()).filter(Boolean);
    if (roles.some((item) => item.toLowerCase() === role.toLowerCase())) return;
    setField("targetRoles", [...roles, role].join(", "));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const supabase = createClient();
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const targetRoles = form.targetRoles.split(",").map((item) => item.trim()).filter(Boolean);
    const skills = form.skills.split(",").map((item) => item.trim()).filter(Boolean);
    const preferredLocations = form.location;
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

  const filteredCities = cityOptions.filter((city) =>
    city.toLowerCase().includes(locationSearch.toLowerCase().trim())
  );

  return (
    <main className="min-h-screen bg-[#05080c] px-6 py-10 text-white lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </Link>
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
          <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1118] p-6 shadow-[0_20px_60px_rgba(0,0,0,.22)]">
            <h2 className="text-xl font-semibold">Your profile</h2>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Full name</span>
              <input required value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="Your full name" />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Professional headline</span>
              <input value={form.headline} onChange={(e) => handleHeadlineChange(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="Finance professional | FP&A | Business Finance" />
              <span className="mt-2 block text-xs text-white/45">Add your headline and HiddenHire will suggest relevant roles automatically.</span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Preferred roles</span>
              <input required value={form.targetRoles} onChange={(e) => setField("targetRoles", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="Finance Manager, FP&A Manager" />
              <span className="mt-2 block text-xs text-white/45">Suggested from your headline. You can edit or add roles manually.</span>
              <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/75">Recommended for you</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedRoles.map((role) => (
                    <button type="button" key={role} onClick={() => addRole(role)} className="rounded-full border border-cyan-200/15 bg-[#101820] px-3 py-1.5 text-xs text-cyan-100/80 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-50">
                      + {role}
                    </button>
                  ))}
                </div>
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Core skills</span>
              <input required value={form.skills} onChange={(e) => setField("skills", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="FP&A, Excel, forecasting, financial analysis" />
            </label>
          </section>

          <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1118] p-6 shadow-[0_20px_60px_rgba(0,0,0,.22)]">
            <h2 className="text-xl font-semibold">Opportunity preferences</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/65">Experience</span>
                <input type="number" min="0" step="0.5" value={form.experienceYears} onChange={(e) => setField("experienceYears", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="6" />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/65">Minimum salary</span>
                <input type="number" min="0" value={form.minSalary} onChange={(e) => setField("minSalary", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" placeholder="900000" />
              </label>
            </div>

            <div className="relative">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Preferred locations</span>
              <button type="button" onClick={() => setLocationOpen((open) => !open)} className="mt-2 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-left text-white outline-none transition hover:border-white/25 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
                <span className={form.location.length ? "text-white" : "text-white/35"}>
                  {form.location.length ? form.location.join(", ") : "Select one or more cities"}
                </span>
                <span className="shrink-0 text-white/50">{locationOpen ? "⌃" : "⌄"}</span>
              </button>

              {locationOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-white/15 bg-[#0b1118] p-3 shadow-[0_24px_70px_rgba(0,0,0,.55)]">
                  <input value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} className="w-full rounded-lg border border-white/15 bg-[#101820] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60" placeholder="Search cities..." autoFocus />
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#080d13] p-1">
                    {filteredCities.length ? filteredCities.map((city) => (
                      <label key={city} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white">
                        <input type="checkbox" checked={form.location.includes(city)} onChange={() => toggleLocation(city)} className="h-4 w-4 accent-cyan-300" />
                        <span>{city}</span>
                      </label>
                    )) : <div className="px-3 py-3 text-sm text-white/40">No matching city found.</div>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-white/45">{form.location.length} {form.location.length === 1 ? "city" : "cities"} selected</span>
                    <button type="button" onClick={() => { setLocationOpen(false); setLocationSearch(""); }} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-300/15">Done</button>
                  </div>
                </div>
              )}
              <span className="mt-2 block text-xs text-white/45">Select multiple cities from the list. Your choices are saved as preferred locations.</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/65">Country</span>
                <input value={form.country} onChange={(e) => setField("country", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-white/65">Currency</span>
                <select value={form.currency} onChange={(e) => setField("currency", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#101820] p-4">
              <input type="checkbox" checked={form.remoteOnly} onChange={(e) => setField("remoteOnly", e.target.checked)} className="h-4 w-4 accent-cyan-300" />
              <span>
                <span className="block text-sm font-medium text-white">Remote-only</span>
                <span className="mt-1 block text-xs text-white/45">Prioritize remote roles and clear physical-location constraints.</span>
              </span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.16em] text-white/65">Job search mode</span>
              <select value={form.jobSearchMode} onChange={(e) => setField("jobSearchMode", e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101820] px-4 py-3 text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
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
