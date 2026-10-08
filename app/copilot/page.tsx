import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CareerCopilot from "@/components/career-copilot";

export default async function CareerCopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, location, skills, experience_years, min_salary, remote_only")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "candidate") redirect("/dashboard");

  const { data: candidateProfile } = await supabase
    .from("candidate_profiles")
    .select("target_roles, preferred_locations")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: applications } = await supabase
    .from("applications")
    .select("status, created_at, jobs(title, companies(name))")
    .eq("candidate_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  const normalizedApplications = (applications ?? []).map((application) => {
    const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const companies = job?.companies;
    const company = Array.isArray(companies) ? companies[0] : companies;
    return {
      status: application.status,
      created_at: application.created_at,
      title: job?.title ?? null,
      company: company?.name ?? null,
    };
  });

  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const profileSignals = [
    Boolean(profile?.full_name),
    Boolean(profile?.location),
    skills.length > 0,
    typeof profile?.experience_years === "number" && profile.experience_years > 0,
  ];
  const profileReadiness = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);

  return (
    <main className="min-h-screen bg-[#05090d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-xs text-cyan-200 hover:text-cyan-100">← Back to dashboard</Link>
        <CareerCopilot
          targetRoles={Array.isArray(candidateProfile?.target_roles) ? candidateProfile.target_roles : []}
          preferredLocations={Array.isArray(candidateProfile?.preferred_locations) ? candidateProfile.preferred_locations : []}
          location={profile?.location ?? null}
          skills={skills}
          yearsOfExperience={Number(profile?.experience_years ?? 0)}
          minimumSalary={Number(profile?.min_salary ?? 0)}
          remoteOnly={Boolean(profile?.remote_only)}
          applications={normalizedApplications}
          profileReadiness={profileReadiness}
        />
      </div>
    </main>
  );
}
