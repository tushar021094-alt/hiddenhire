import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const guides = [
  { number: "01", title: "Write a role that attracts relevant candidates", description: "Use a specific job title, clear responsibilities, required skills, realistic experience and a transparent salary range so matching can prioritize role fit.", action: "Create a job", href: "/recruiter" },
  { number: "02", title: "Review candidates consistently", description: "Open a role's hiring workflow, compare the match reasons against its requirements, and use the same criteria for every applicant.", action: "Find talent", href: "/recruiter/talent" },
  { number: "03", title: "Keep applicants informed", description: "Review incoming applications regularly and record decisions or status updates promptly. Clear communication improves the candidate experience.", action: "Open dashboard", href: "/dashboard#insights" },
];

export default async function RecruiterLearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "employer" && profile?.role !== "agency") redirect("/dashboard");

  return (
    <main className="hh-dashboard min-h-screen">
      <div className="hh-shell">
        <div className="mb-8">
          <p className="hh-eyebrow">EMPLOYER PLAYBOOK</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Learn to hire with HiddenHire</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Practical guidance for creating clear roles, evaluating relevant matches and keeping your hiring process responsive.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">{guides.map((guide) => (
          <article key={guide.number} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <span className="text-sm font-semibold tracking-widest text-cyan-300">{guide.number}</span>
            <h2 className="mt-5 text-xl font-semibold text-white">{guide.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-white/55">{guide.description}</p>
            <Link href={guide.href} className="mt-6 inline-flex w-fit rounded-lg border border-cyan-300/25 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-300/10">{guide.action} →</Link>
          </article>
        ))}</div>
        <div className="mt-6"><Link href="/dashboard#insights" className="text-sm text-cyan-200 hover:text-cyan-100">← Back to recruiter dashboard</Link></div>
      </div>
    </main>
  );
}
