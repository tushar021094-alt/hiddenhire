import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_BODY_BYTES = 32_000;
const MAX_ROLE_LENGTH = 200;
const MAX_SKILL_LENGTH = 100;
const MAX_SKILLS = 30;
const MAX_COUNTRY_LENGTH = 100;
const SALARY_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimmedText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function normalizeEducation(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).filter(isRecord).map((item) => ({
    qualification: trimmedText(item.qualification, 200) || "Qualification",
    institution: trimmedText(item.institution, 200),
    year: trimmedText(item.year, 30),
  }));
}

function normalizeWorkExperience(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 15).filter(isRecord).map((item) => ({
    title: trimmedText(item.title, 200),
    company: trimmedText(item.company, 200),
    startDate: trimmedText(item.startDate, 50),
    endDate: trimmedText(item.endDate, 50),
    summary: trimmedText(item.summary, 700),
  }));
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean))].slice(0, maxItems);
}

export async function GET() {
  try {
    const { supabase, user, error } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: error || "Authentication is required." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,role,full_name,skills,experience_years,country,remote_only,min_salary,salary_currency,visibility")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const { data: career, error: careerError } = await supabase
      .from("candidate_profiles")
      .select("job_search_mode,target_roles,preferred_locations,headline,education,work_experience,certifications,resume_summary,recommended_target_roles,suggested_salary_min,suggested_salary_max,suggested_salary_currency,salary_recommendation_rationale,salary_recommendation_confidence")
      .eq("profile_id", user.id)
      .maybeSingle();
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
    if (!isRecord(body)) return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });

    const input = body;
    const role = typeof input.role === "string" ? input.role.trim() : "";
    const country = typeof input.country === "string" ? input.country.trim() : "India";
    const headline = typeof input.headline === "string" ? input.headline.trim() : "";
    const experience = Number(input.experience);
    const skills = Array.isArray(input.skills) ? input.skills.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean) : [];
    const remoteOnly = Boolean(input.remoteOnly);
    const minSalary = Number(input.minSalary);
    const salaryCurrency = typeof input.salaryCurrency === "string" ? input.salaryCurrency.trim().toUpperCase() : "INR";
    const fullName = trimmedText(input.fullName, 160);

    if (!role || role.length > MAX_ROLE_LENGTH) return NextResponse.json({ error: "A valid target role is required." }, { status: 400 });
    if (skills.length > MAX_SKILLS || skills.some(skill => skill.length > MAX_SKILL_LENGTH)) return NextResponse.json({ error: "Too many or overly long skills." }, { status: 400 });
    if (country.length > MAX_COUNTRY_LENGTH || !Number.isInteger(experience) || experience < 0 || experience > 60) return NextResponse.json({ error: "Experience or country is invalid." }, { status: 400 });
    if (!Number.isFinite(minSalary) || minSalary < 0 || minSalary > 1_000_000_000) return NextResponse.json({ error: "Minimum salary is invalid." }, { status: 400 });
    if (!(SALARY_CURRENCIES as readonly string[]).includes(salaryCurrency)) return NextResponse.json({ error: "Unsupported salary currency." }, { status: 400 });

    const resumeDetails = isRecord(input.resumeDetails) ? input.resumeDetails : null;
    const recommendedTargetRoles = normalizeStringArray(input.recommendedTargetRoles, 5, MAX_ROLE_LENGTH);
    const salaryRecommendation = isRecord(input.salaryRecommendation) ? input.salaryRecommendation : null;
    let suggestedSalaryMin: number | null = null;
    let suggestedSalaryMax: number | null = null;
    let suggestedSalaryCurrency: string | null = null;
    let salaryRecommendationRationale: string | null = null;
    let salaryRecommendationConfidence: string | null = null;

    if (salaryRecommendation) {
      const minValue = salaryRecommendation.minimumAnnual;
      const maxValue = salaryRecommendation.maximumAnnual;
      const min = typeof minValue === "number" && Number.isFinite(minValue) && minValue >= 0 && minValue <= 1_000_000_000 ? minValue : null;
      const max = typeof maxValue === "number" && Number.isFinite(maxValue) && maxValue >= 0 && maxValue <= 1_000_000_000 ? maxValue : null;
      const recommendationCurrency = typeof salaryRecommendation.currency === "string" ? salaryRecommendation.currency.trim().toUpperCase() : salaryCurrency;
      if (!(SALARY_CURRENCIES as readonly string[]).includes(recommendationCurrency) || (min !== null && max !== null && min > max)) {
        return NextResponse.json({ error: "Salary recommendation is invalid." }, { status: 400 });
      }
      suggestedSalaryMin = min;
      suggestedSalaryMax = max;
      suggestedSalaryCurrency = recommendationCurrency;
      salaryRecommendationRationale = trimmedText(salaryRecommendation.rationale, 600);
      salaryRecommendationConfidence = ["low", "medium", "high"].includes(String(salaryRecommendation.confidence))
        ? String(salaryRecommendation.confidence)
        : "low";
    }

    const { data: current, error: roleError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (roleError) throw roleError;
    if (current?.role !== "candidate") return NextResponse.json({ error: "Only candidate accounts can edit a career profile." }, { status: 403 });

    const profileUpdate: JsonRecord = {
      skills,
      experience_years: experience,
      country: country || null,
      remote_only: remoteOnly,
      min_salary: minSalary,
      salary_currency: salaryCurrency,
    };
    if (fullName) profileUpdate.full_name = fullName;
    const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
    if (profileError) throw profileError;

    const careerUpdate: JsonRecord = {
      profile_id: user.id,
      job_search_mode: "active",
      target_roles: [role],
      preferred_locations: country ? [country] : [],
      headline: headline || null,
    };
    if (resumeDetails) {
      careerUpdate.education = normalizeEducation(resumeDetails.education);
      careerUpdate.work_experience = normalizeWorkExperience(resumeDetails.workExperience);
      careerUpdate.certifications = normalizeStringArray(resumeDetails.certifications, 20, 200);
      careerUpdate.resume_summary = trimmedText(resumeDetails.summary, 4_000);
    }
    if (Array.isArray(input.recommendedTargetRoles)) careerUpdate.recommended_target_roles = recommendedTargetRoles;
    if (salaryRecommendation) {
      careerUpdate.suggested_salary_min = suggestedSalaryMin;
      careerUpdate.suggested_salary_max = suggestedSalaryMax;
      careerUpdate.suggested_salary_currency = suggestedSalaryCurrency;
      careerUpdate.salary_recommendation_rationale = salaryRecommendationRationale;
      careerUpdate.salary_recommendation_confidence = salaryRecommendationConfidence;
    }

    const { error: careerError } = await supabase.from("candidate_profiles").upsert(careerUpdate, { onConflict: "profile_id" });
    if (careerError) throw careerError;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save your career profile." }, { status: 500 });
  }
}
