import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RecruiterTalentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "employer" && profile?.role !== "agency") {
    return (
      <main className="hh-dashboard min-h-screen">
        <div className="hh-shell mx-auto max-w-3xl px-6 py-16">
          <p className="hh-eyebrow">RECRUITER WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Recruiter access is not enabled for this account</h1>
          <p className="mt-4 text-sm leading-7 text-white/60">
            {profile?.role === "candidate"
              ? "This account is currently configured as a candidate. Find Talent is restricted to Employer and Agency accounts, so HiddenHire has stopped here rather than silently redirecting you to another workspace."
              : "HiddenHire could not confirm an Employer or Agency role for this account. Access is paused to avoid opening the wrong workspace."}
          </p>
          <p className="mt-3 text-sm leading-7 text-white/45">If this should be a recruiter account, the saved profile role needs an authorized correction. It has not been changed automatically.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl border border-white/10 px-5 py-3 text-sm text-white/75">Open current workspace</Link>
        </div>
      </main>
    );
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, city, region, remote, status, created_at")
    .eq("posted_by", user.id)
    .order("created_at", { ascending: false });

  const jobList = Array.isArray(jobs) ? jobs : [];

  return (
    <main className="hh-dashboard min-h-screen">
      <div className="hh-shell">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="hh-eyebrow">EMPLOYER INTELLIGENCE</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Find the right talent</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Choose one of your roles to review its candidate matches and hiring workflow. HiddenHire keeps candidate discovery tied to a real job requirement.</p>
          </div>
          <Link href="/recruiter" className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">Post a job →</Link>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-white/45">Your roles</p><p className="mt-2 text-3xl font-semibold text-white">{jobList.length}</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-white/45">Published</p><p className="mt-2 text-3xl font-semibold text-white">{jobList.filter((job) => job.status === "published").length}</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><p className="text-xs uppercase tracking-wider text-white/45">Awaiting review</p><p className="mt-2 text-3xl font-semibold text-white">{jobList.filter((job) => job.status === "pending_review").length}</p></article>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 p-5"><h2 className="text-lg font-semibold text-white">Select a role</h2><p className="mt-1 text-sm text-white/50">Open a role to manage its applicants and candidate signals.</p></div>
          {jobList.length === 0 ? (
            <div className="p-8 text-center"><h3 className="text-lg font-semibold text-white">Start with your first job</h3><p className="mx-auto mt-2 max-w-lg text-sm text-white/55">Once you post a role, you can return here to open its hiring workflow and review the candidate matches available for it.</p><Link href="/recruiter" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">Create your first job →</Link></div>
          ) : (
            <div className="divide-y divide-white/10">{jobList.map((job) => (
              <article key={job.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold text-white">{job.title}</h3><p className="mt-1 text-sm text-white/55">{job.city || job.region || "Location not specified"}{job.remote ? " · Remote" : ""}</p><span className="mt-2 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">{job.status.replaceAll("_", " ")}</span></div>
                <Link href={`/recruiter/jobs/${job.id}`} className="rounded-lg border border-cyan-300/25 px-4 py-2.5 text-center text-sm font-medium text-cyan-200 hover:bg-cyan-300/10">Open hiring workflow →</Link>
              </article>
            ))}</div>
          )}
        </section>

        <div className="mt-6"><Link href="/dashboard#insights" className="text-sm text-cyan-200 hover:text-cyan-100">← Back to recruiter dashboard</Link></div>
      </div>
    </main>
  );
}
