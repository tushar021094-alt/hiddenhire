import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildCareerExecutionPackage } from "@/lib/career-execution";

function companyName(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string | null } | undefined;
    return first?.name ?? null;
  }
  return (value as { name?: string | null } | null | undefined)?.name ?? null;
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedApplicationId = url.searchParams.get("applicationId")?.trim() || "";

  const [{ data: profile, error: profileError }, { data: career, error: careerError }, { data: applications, error: applicationsError }] = await Promise.all([
    supabase.from("profiles").select("full_name,skills,experience_years,location").eq("id", user.id).maybeSingle(),
    supabase.from("candidate_profiles").select("headline,target_roles").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("applications")
      .select("id,status,created_at,updated_at,jobs(id,title,application_url,location,companies(name))")
      .eq("candidate_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  if (profileError || careerError || applicationsError) {
    return NextResponse.json({ error: "Unable to build your execution package." }, { status: 500 });
  }

  const rows = applications ?? [];
  const selected = requestedApplicationId
    ? rows.find((item) => item.id === requestedApplicationId)
    : rows.find((item) => !["rejected", "withdrawn", "hired"].includes(item.status)) ?? rows[0];

  if (!selected) {
    return NextResponse.json({ package: null, applications: [] });
  }

  const job = Array.isArray(selected.jobs) ? selected.jobs[0] : selected.jobs;
  const packageData = buildCareerExecutionPackage({
    candidate: {
      name: profile?.full_name,
      headline: career?.headline,
      targetRole: career?.target_roles?.[0],
      experienceYears: profile?.experience_years,
      skills: Array.isArray(profile?.skills) ? profile.skills.filter((item): item is string => typeof item === "string") : [],
      location: profile?.location,
    },
    application: {
      id: selected.id,
      status: selected.status,
      createdAt: selected.created_at,
      updatedAt: selected.updated_at,
    },
    job: {
      title: job?.title,
      company: companyName(job?.companies),
      location: job?.location,
      applicationUrl: job?.application_url,
    },
  });

  const applicationOptions = rows.map((item) => {
    const itemJob = Array.isArray(item.jobs) ? item.jobs[0] : item.jobs;
    return {
      id: item.id,
      status: item.status,
      title: itemJob?.title ?? "Application",
      company: companyName(itemJob?.companies) ?? "Company",
    };
  });

  return NextResponse.json({
    package: packageData,
    applications: applicationOptions,
    phase: 21,
  });
}
