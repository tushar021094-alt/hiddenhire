import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { buildApplicationPreparation } from "@/lib/application-preparation";

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const fingerprint = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).jobFingerprint === "string"
    ? String((body as Record<string, unknown>).jobFingerprint).trim() : "";
  if (!fingerprint || fingerprint.length > 300) return NextResponse.json({ error: "jobFingerprint is required." }, { status: 400 });

  const { data: watches, error: watchError } = await supabase.from("job_watches").select("id").eq("candidate_id", user.id);
  if (watchError) return NextResponse.json({ error: "Unable to verify the opportunity." }, { status: 500 });
  const watchIds = (watches ?? []).map((watch) => watch.id);
  if (!watchIds.length) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const { data: events, error: eventError } = await supabase
    .from("job_watch_events")
    .select("watch_id,job_fingerprint,current_score,payload,created_at")
    .in("watch_id", watchIds).eq("job_fingerprint", fingerprint)
    .order("created_at", { ascending: false }).limit(1);
  if (eventError || !events?.length) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  const payload = (events[0].payload && typeof events[0].payload === "object" && !Array.isArray(events[0].payload)) ? events[0].payload as Record<string, unknown> : {};

  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name,skills,experience_years,country").eq("id", user.id).maybeSingle();
  const { data: career, error: careerError } = await supabase.from("candidate_profiles").select("target_roles,headline").eq("profile_id", user.id).maybeSingle();
  if (profileError || careerError) return NextResponse.json({ error: "Unable to load your career profile." }, { status: 500 });

  const result = buildApplicationPreparation({
    targetRole: typeof payload.title === "string" ? payload.title : (career?.target_roles?.[0] || "the role"),
    company: typeof payload.company === "string" ? payload.company : "the company",
    location: typeof payload.location === "string" ? payload.location : "Location not specified",
    candidate: { headline: career?.headline, targetRole: career?.target_roles?.[0], experienceYears: profile?.experience_years, skills: Array.isArray(profile?.skills) ? profile.skills.filter((value): value is string => typeof value === "string") : [], country: profile?.country },
    job: {
      description: typeof payload.description === "string" ? payload.description : null,
      requiredSkills: Array.isArray(payload.requiredSkills) ? payload.requiredSkills.filter((value): value is string => typeof value === "string") : [],
      requiredExperience: typeof payload.requiredExperience === "number" ? payload.requiredExperience : null,
      industry: typeof payload.industry === "string" ? payload.industry : null,
      source: typeof payload.source === "string" ? payload.source : null,
    },
  });

  return NextResponse.json({ success: true, score: Number(events[0].current_score ?? 0), preparation: result });
}