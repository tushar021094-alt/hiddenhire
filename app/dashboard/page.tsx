import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  full_name: string | null;
  role: "candidate" | "employer" | "agency" | "admin";
  location: string | null;
  skills: string[] | null;
  experience_years: number | null;
};

const roleCopy = {
  candidate: {
    eyebrow: "Candidate Intelligence",
    title: "Your career, continuously matched.",
    subtitle: "HiddenHire turns your profile into a live opportunity signal and surfaces roles worth your attention.",
    primary: "Complete your profile",
    secondary: "Explore matched jobs",
    cards: [
      ["Match Radar", "AI-ranked opportunities based on role, skills, experience, location and compensation."],
      ["Career Signal", "See where your profile is strongest and where targeted skill improvements can increase fit."],
      ["Application Control", "Track applications, saved jobs and recruiter activity from one workspace."],
    ],
  },
  employer: {
    eyebrow: "Employer Intelligence",
    title: "Find the people who actually fit.",
    subtitle: "Post roles, let HiddenHire understand the job, and build a qualified shortlist without screening hundreds of profiles manually.",
    primary: "Post a job",
    secondary: "Open applicant pipeline",
    cards: [
      ["Candidate Match Radar", "AI-ranked candidates with explainable fit across function, skills, experience, location and salary."],
      ["AI Shortlist", "Turn a large applicant pool into a focused shortlist with consistent matching logic."],
      ["Hiring Funnel", "Track open roles, applications, matches and next actions from one employer workspace."],
    ],
  },
  agency: {
    eyebrow: "Recruiter Intelligence",
    title: "Your recruiting desk, powered by AI.",
    subtitle: "Search, match and manage candidates across client roles with a workflow designed for recruitment agencies.",
    primary: "Create a recruiter job",
    secondary: "Open candidate search",
    cards: [
      ["Multi-role Matching", "Match your candidate pool against multiple client requirements and surface the strongest fits."],
      ["AI Shortlists", "Generate explainable shortlists instead of manually reviewing every profile."],
      ["Recruiter Workflow", "Keep jobs, candidates, outreach and hiring progress in one workspace."],
    ],
  },
  admin: {
    eyebrow: "Platform Operations",
    title: "HiddenHire control centre.",
    subtitle: "Monitor platform activity, verification, moderation and marketplace health.",
    primary: "Review activity",
    secondary: "Open moderation",
    cards: [
      ["Verification", "Review employer and recruiter verification states."],
      ["Moderation", "Surface suspicious, duplicate or policy-sensitive marketplace activity."],
      ["Platform Health", "Monitor jobs, applications, matches and operational signals."],
    ],
  },
} as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, location, skills, experience_years")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "candidate") as keyof typeof roleCopy;
  const copy = roleCopy[role] ?? roleCopy.candidate;
  const name = profile?.full_name || user.email?.split("@")[0] || "there";
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];

  return (
    <main className="min-h-screen bg-[#05080c] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <a href="/" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </a>
          <div className="flex items-center gap-3 text-sm text-white/60">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-cyan-200">
              {role === "agency" ? "Recruiter" : role === "employer" ? "Employer" : role === "candidate" ? "Candidate" : "Admin"}
            </span>
            <span>{user.email}</span>
          </div>
        </header>

        <section className="relative overflow-hidden py-14 lg:py-20">
          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative max-w-4xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">{copy.eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              Hi {name.split(" ")[0]},<br />
              <span className="text-cyan-300">{copy.title}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">{copy.subtitle}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {copy.cards.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
              <div className="mb-8 h-2 w-16 rounded-full bg-cyan-300/70" />
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">AI workspace</p>
                <h2 className="mt-2 text-2xl font-semibold">{copy.primary}</h2>
              </div>
              <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs text-cyan-200">Ready</span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
              Your next dashboard modules will appear here as we connect real profiles, jobs, applications and matching data to Supabase.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={role === "candidate" ? "/onboarding" : "/recruiter"} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">{copy.primary}</Link>
              <Link href={role === "candidate" ? "/jobs" : "/recruiter"} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">{copy.secondary}</Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Profile signal</p>
            <div className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-white/45">Experience</span><span>{profile?.experience_years ?? 0} yrs</span></div>
              <div className="flex justify-between gap-4"><span className="text-white/45">Location</span><span>{profile?.location || "Not set"}</span></div>
              <div><span className="text-white/45">Skills</span><div className="mt-2 flex flex-wrap gap-2">{(skills.length ? skills.slice(0, 8) : ["Add skills"]).map((skill) => <span key={skill} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70">{skill}</span>)}</div></div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
