import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildCareerRelationships } from "@/lib/career-network";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { data: applications, error } = await supabase
    .from("applications")
    .select("id,status,created_at,updated_at,recruiter_response_count,jobs(posted_by,company_id,companies(name))")
    .eq("candidate_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Unable to build career network." }, { status: 500 });
  }

  const relationships = buildCareerRelationships((applications ?? []).map((application) => {
    const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const companies = job && typeof job === "object" && "companies" in job ? job.companies : null;
    const company = Array.isArray(companies) ? companies[0] : companies;
    return {
      recruiterId: job?.posted_by ?? null,
      companyId: job?.company_id ?? null,
      companyName: company && typeof company === "object" && "name" in company ? String(company.name ?? "") : null,
      status: application.status,
      createdAt: application.created_at,
      updatedAt: application.updated_at,
      recruiterResponseCount: application.recruiter_response_count,
    };
  }));

  return NextResponse.json({
    relationships: relationships.slice(0, 12),
    counts: {
      total: relationships.length,
      active: relationships.filter((item) => item.status === "active").length,
      interviewStage: relationships.filter((item) => item.status === "interview_stage").length,
      reconnect: relationships.filter((item) => item.status === "reconnect").length,
    },
  });
}
