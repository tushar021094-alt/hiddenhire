import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type CandidateSummary = {
  candidate_id: string;
  full_name: string | null;
  headline: string | null;
  skills: string[] | null;
  experience_years: number | null;
  location: string | null;
  country: string | null;
};

const recruiterRoles = new Set(["employer", "agency", "admin"]);

export async function GET() {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: "Unable to verify your account." }, { status: 500 });
    if (!profile?.role || !recruiterRoles.has(profile.role)) {
      return NextResponse.json({ error: "Employer, agency or admin access is required." }, { status: 403 });
    }

    let jobsQuery = supabase
      .from("jobs")
      .select("id, title, city, region, country, remote, salary_min, salary_max, currency")
      .eq("source_type", "native");

    if (profile.role !== "admin") jobsQuery = jobsQuery.eq("posted_by", user.id);

    const { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError) {
      console.error("Unable to load recruiter jobs", jobsError);
      return NextResponse.json({ error: "Unable to load recruiter jobs." }, { status: 500 });
    }

    const jobIds = (jobs ?? []).map((job) => job.id);
    if (jobIds.length === 0) return NextResponse.json({ applications: [] });

    const { data: applications, error: applicationsError } = await supabase
      .from("applications")
      .select("id, job_id, candidate_id, status, created_at, updated_at, jobs!inner(id, title, city, region, country, remote, salary_min, salary_max, currency)")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (applicationsError) {
      console.error("Unable to load recruiter applications", applicationsError);
      return NextResponse.json({ error: "Unable to load recruiter applications." }, { status: 500 });
    }

    const summaries = new Map<string, CandidateSummary>();

    for (const jobId of jobIds) {
      const { data: candidates, error: candidateError } = await supabase.rpc(
        "recruiter_candidate_discovery_for_job",
        { p_job_id: jobId },
      );

      if (candidateError) {
        console.error("Unable to load candidate summaries", candidateError);
        continue;
      }

      for (const candidate of (candidates ?? []) as CandidateSummary[]) {
        summaries.set(candidate.candidate_id, candidate);
      }
    }

    return NextResponse.json({
      applications: (applications ?? []).map((application) => ({
        ...application,
        candidate: summaries.get(application.candidate_id) ?? null,
      })),
    });
  } catch (error) {
    console.error("Recruiter applications error", error);
    return NextResponse.json({ error: "Unable to load recruiter applications." }, { status: 500 });
  }
}
