import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 8_000;
const MAX_ROLE_LENGTH = 200;
const MAX_SKILL_LENGTH = 100;
const MAX_SKILLS = 30;
const MAX_COUNTRY_LENGTH = 100;

export async function GET() {
  try {
    const { supabase, user, error } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: error || "Authentication is required." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id,email,role,full_name,skills,experience_years,country,remote_only,min_salary,salary_currency,visibility").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const { data: career, error: careerError } = await supabase.from("candidate_profiles").select("job_search_mode,target_roles,preferred_locations,headline").eq("profile_id", user.id).maybeSingle();
    if (careerError) throw careerError;
    return NextResponse.json({ profile, career });
  } catch {
    return NextResponse.json({ error: "Unable to load your profile." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: error || "Authentication is required." }, { status: 401 });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });

    const input = body as Record<string, unknown>;
    const role = typeof input.role === "string" ? input.role.trim() : "";
    const country = typeof input.country === "string" ? input.country.trim() : "India";
    const headline = typeof input.headline === "string" ? input.headline.trim() : "";
    const experience = Number(input.experience);
    const skills = Array.isArray(input.skills) ? input.skills.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean) : [];
    const remoteOnly = Boolean(input.remoteOnly);
    const minSalary = Number(input.minSalary);
    const salaryCurrency = typeof input.salaryCurrency === "string" ? input.salaryCurrency.trim().toUpperCase() : "INR";

    if (!role || role.length > MAX_ROLE_LENGTH) return NextResponse.json({ error: "A valid target role is required." }, { status: 400 });
    if (skills.length > MAX_SKILLS || skills.some(skill => skill.length > MAX_SKILL_LENGTH)) return NextResponse.json({ error: "Too many or overly long skills." }, { status: 400 });
    if (country.length > MAX_COUNTRY_LENGTH || !Number.isInteger(experience) || experience < 0 || experience > 60) return NextResponse.json({ error: "Experience or country is invalid." }, { status: 400 });
    if (!Number.isFinite(minSalary) || minSalary < 0 || minSalary > 1_000_000_000) return NextResponse.json({ error: "Minimum salary is invalid." }, { status: 400 });
    if (!["INR", "USD", "EUR", "GBP"].includes(salaryCurrency)) return NextResponse.json({ error: "Unsupported salary currency." }, { status: 400 });

    const { data: current, error: roleError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (roleError) throw roleError;
    if (current?.role !== "candidate") return NextResponse.json({ error: "Only candidate accounts can edit a career profile." }, { status: 403 });

    const { error: profileError } = await supabase.from("profiles").update({ skills, experience_years: experience, country: country || null, remote_only: remoteOnly, min_salary: minSalary, salary_currency: salaryCurrency }).eq("id", user.id);
    if (profileError) throw profileError;

    const { error: careerError } = await supabase.from("candidate_profiles").upsert({
      profile_id: user.id, job_search_mode: "active", target_roles: [role], preferred_locations: country ? [country] : [], headline: headline || null,
    }, { onConflict: "profile_id" });
    if (careerError) throw careerError;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save your career profile." }, { status: 500 });
  }
}
