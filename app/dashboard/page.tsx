import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CareerAgent from "@/components/career-agent";
import JobWatchManager from "@/components/job-watch-manager";

type Profile = {
  full_name: string | null;
  role: "candidate" | "employer" | "agency" | "admin";
  location: string | null;
  skills: string[] | null;
  experience_years: number | null;
  min_salary: number | null;
  remote_only: boolean;
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
    .select("full_name, role, location, skills, experience_years, min_salary, remote_only")
    .eq("id", user.id)
    .maybeSingle();

  const { data: candidateProfile } = profile?.role === "candidate"
    ? await supabase
        .from("candidate_profiles")
        .select("target_roles, preferred_locations")
        .eq("profile_id", user.id)
        .maybeSingle()
    : { data: null };
      const isRecruiter = profile?.role === "employer" || profile?.role === "agency";

  const { data: recruiterJobs } = isRecruiter
    ? await supabase
        .from("jobs")
        .select(
          "id, title, city, region, remote, status, created_at"
        )
        .eq("posted_by", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };
      const recruiterJobList = Array.isArray(recruiterJobs) ? recruiterJobs : [];

  const recruiterJobCount = recruiterJobList.length;
  const recruiterPendingCount = recruiterJobList.filter(
    (job) => job.status === "pending_review"
  ).length;
  const recruiterPublishedCount = recruiterJobList.filter(
    (job) => job.status === "published"
  ).length;

  const role = (profile?.role ?? "candidate") as keyof typeof roleCopy;
  const copy = roleCopy[role] ?? roleCopy.candidate;
  const name = profile?.full_name || user.email?.split("@")[0] || "there";
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const { data: candidateApplications, count: applicationCount } = role === "candidate"
    ? await supabase
        .from("applications")
        .select("id, status, created_at, updated_at, jobs(title, companies(name))", { count: "exact" })
        .eq("candidate_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], count: 0 };
  const profileSignals = [
    Boolean(profile?.full_name),
    Boolean(profile?.location),
    skills.length > 0,
    typeof profile?.experience_years === "number" && profile.experience_years > 0,
  ];
  const profileReadiness = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);

  return (
    <main className="app-v2 min-h-screen bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            Hidden<span className="text-cyan-300">Hire</span>
          </Link>
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

        {role === "candidate" && (
          <CareerAgent
            targetRoles={Array.isArray(candidateProfile?.target_roles) ? candidateProfile.target_roles : []}
            preferredLocations={Array.isArray(candidateProfile?.preferred_locations) ? candidateProfile.preferred_locations : []}
            location={profile?.location ?? null}
            skills={skills}
            yearsOfExperience={Number(profile?.experience_years ?? 0)}
            minimumSalary={Number(profile?.min_salary ?? 0)}
            remoteOnly={Boolean(profile?.remote_only)}
            applications={Array.isArray(candidateApplications) ? candidateApplications : []}
          />
        )}

        {role === "candidate" && (
          <JobWatchManager
            targetRoles={Array.isArray(candidateProfile?.target_roles) ? candidateProfile.target_roles : []}
            preferredLocations={Array.isArray(candidateProfile?.preferred_locations) ? candidateProfile.preferred_locations : []}
            skills={skills}
            minimumSalary={Number(profile?.min_salary ?? 0)}
            currency="INR"
            remoteOnly={Boolean(profile?.remote_only)}
          />
        )}

        {isRecruiter ? (
          <section className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Total jobs</p>
                <p className="mt-3 text-3xl font-semibold">{recruiterJobCount}</p>
                <p className="mt-2 text-sm text-white/45">Jobs created by your account</p>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Pending review</p>
                <p className="mt-3 text-3xl font-semibold">{recruiterPendingCount}</p>
                <p className="mt-2 text-sm text-white/45">Jobs awaiting approval</p>
              </article>

              <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">Published</p>
                <p className="mt-3 text-3xl font-semibold">{recruiterPublishedCount}</p>
                <p className="mt-2 text-sm text-white/45">Live jobs on HiddenHire</p>
              </article>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Recruiter workspace
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Your jobs
                  </h2>
                  <p className="mt-2 text-sm text-white/55">
                    Create jobs, review matching candidates, and manage your hiring workflow.
                  </p>
                </div>

                <Link
                  href="/recruiter"
                  className="rounded-xl bg-cyan-300 px-5 py-3 text-center text-sm font-semibold text-slate-950"
                >
                  Post a job
                </Link>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
                {recruiterJobList.length === 0 ? (
                  <div className="p-6 text-sm text-white/50">
                    You have not created any jobs yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {recruiterJobList.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <h3 className="font-medium">{job.title}</h3>
                          <p className="mt-1 text-sm text-white/45">
                            {job.city || job.region || "India"}
                            {job.remote ? " · Remote" : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                            {job.status.replace("_", " ")}
                          </span>

                          <Link
                            href={`/recruiter/jobs/${job.id}`}
                            className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                          >
                            Manage
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
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

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Profile readiness</p>
                  <p className="mt-2 text-2xl font-semibold text-cyan-200">{profileReadiness}%</p>
                  <p className="mt-1 text-xs text-white/45">Completeness signal</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Applications</p>
                  <p className="mt-2 text-2xl font-semibold">{applicationCount ?? 0}</p>
                  <p className="mt-1 text-xs text-white/45">Tracked in HiddenHire</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Next move</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-200">{profileReadiness < 100 ? "Strengthen profile" : "Review matches"}</p>
                  <p className="mt-1 text-xs text-white/45">Career agent recommendation</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={role === "candidate" ? "/onboarding" : "/recruiter"}
                  className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
                >
                  {copy.primary}
                </Link>

                <Link
  href={
    role === "admin"
      ? "/admin/moderation"
      : role === "candidate"
        ? "/jobs"
        : "/recruiter"
  }
  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
>
  {copy.secondary}
</Link>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Profile signal</p>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Experience</span>
                  <span>{profile?.experience_years ?? 0} yrs</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-white/45">Location</span>
                  <span>{profile?.location || "Not set"}</span>
                </div>

                <div>
                  <span className="text-white/45">Skills</span>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(skills.length ? skills.slice(0, 8) : ["Add skills"]).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}