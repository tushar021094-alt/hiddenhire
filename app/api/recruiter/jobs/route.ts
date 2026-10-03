import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { calculateJobMatch } from "@/lib/match-engine";
import {
  toCandidateProfile,
  toRecruiterJob,
  type RecruiterCandidateRow,
} from "@/lib/recruiter-matching";

type RecruiterJobInput = {
  title?: string;
  description?: string;
  jobFunction?: string;
  company?: string;
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  experienceMin?: number;
  experienceMax?: number;
  skills?: string[];
};

async function normalizeJob(input: RecruiterJobInput) {
  const fallback = {
    role: input.title?.trim() || "",
    skills: Array.isArray(input.skills)
      ? input.skills.filter((value): value is string => typeof value === "string").slice(0, 30)
      : [],
  };

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  try {
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Normalize a job for candidate matching. Return JSON only: {role:string,skills:string[]}. Preserve the actual job function and do not invent requirements.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            description: input.description,
            skills: input.skills,
          }),
        },
      ],
    });

    const parsed = JSON.parse(
      response.choices[0]?.message?.content || "{}"
    );

    return {
      role:
        typeof parsed.role === "string" && parsed.role.trim()
          ? parsed.role.trim()
          : fallback.role,
      skills: Array.isArray(parsed.skills)
        ? parsed.skills
            .filter((value: unknown): value is string => typeof value === "string")
            .map((value: string) => value.trim())
            .filter(Boolean)
            .slice(0, 30)
        : fallback.skills,
    };
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: authError || "Authentication is required." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as RecruiterJobInput;

    const title = body.title?.trim() || "";
    const description = body.description?.trim() || "";

    if (title.length > 200 || description.length > 20_000) {
      return NextResponse.json(
        { error: "Job title or description is too long." },
        { status: 413 }
      );
    }

    const salaryMin =
      body.salaryMin === undefined ? null : Number(body.salaryMin);
    const salaryMax =
      body.salaryMax === undefined ? null : Number(body.salaryMax);
    const experienceMin =
      body.experienceMin === undefined ? null : Number(body.experienceMin);
    const experienceMax =
      body.experienceMax === undefined ? null : Number(body.experienceMax);

    const invalidNumber =
      [salaryMin, salaryMax, experienceMin, experienceMax].some(
        (value) => value !== null && !Number.isFinite(value)
      );

    if (invalidNumber) {
      return NextResponse.json(
        { error: "Salary and experience values must be valid numbers." },
        { status: 400 }
      );
    }

    if (
      [salaryMin, salaryMax].some(
        (value) => value !== null && (value < 0 || value > 1_000_000_000)
      )
    ) {
      return NextResponse.json(
        { error: "Salary values are outside the supported range." },
        { status: 400 }
      );
    }

    if (
      [experienceMin, experienceMax].some(
        (value) => value !== null && (value < 0 || value > 60)
      ) ||
      [experienceMin, experienceMax].some(
        (value) => value !== null && !Number.isInteger(value)
      )
    ) {
      return NextResponse.json(
        { error: "Experience must be a whole number between 0 and 60 years." },
        { status: 400 }
      );
    }
    const allowedJobFunctions = [
  "Finance",
  "Accounting",
  "FP&A",
  "Audit",
  "Tax",
  "Treasury",
  "Risk",
  "Operations",
  "Engineering",
  "Software",
  "Data",
  "Product",
  "Marketing",
  "Sales",
  "HR",
  "Legal",
  "Customer Success",
  "Design",
  "Other",
] as const;

const jobFunction = body.jobFunction?.trim() || "";

if (
  !allowedJobFunctions.includes(
    jobFunction as (typeof allowedJobFunctions)[number],
  )
) {
  return NextResponse.json(
    { error: "A valid job function is required." },
    { status: 400 },
  );
}

    if (!title || !description) {
      return NextResponse.json(
        { error: "Job title and description are required." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Your HiddenHire profile could not be found." },
        { status: 403 }
      );
    }

    if (profile.role !== "employer" && profile.role !== "agency") {
      return NextResponse.json(
        { error: "Only employers and agencies can post jobs." },
        { status: 403 }
      );
    }
if (profile.role === "employer") {
  const { data: employerVerification, error: verificationError } =
    await supabase
      .from("employer_profiles")
      .select("recruiter_verified")
      .eq("profile_id", user.id)
      .maybeSingle();

  if (verificationError) {
    return NextResponse.json(
      { error: "Unable to verify your employer status." },
      { status: 500 }
    );
  }

  if (!employerVerification?.recruiter_verified) {
    return NextResponse.json(
      {
        error:
          "Employer verification is required before you can post a job.",
      },
      { status: 403 }
    );
  }
}

if (profile.role === "agency") {
  const { data: agencyVerification, error: verificationError } =
    await supabase
      .from("agency_profiles")
      .select("verified")
      .eq("profile_id", user.id)
      .maybeSingle();

  if (verificationError) {
    return NextResponse.json(
      { error: "Unable to verify your agency status." },
      { status: 500 }
    );
  }

  if (!agencyVerification?.verified) {
    return NextResponse.json(
      {
        error:
          "Agency verification is required before you can post a job.",
      },
      { status: 403 }
    );
  }
}

    const country = (body.country || "India").trim();

    if (country.toLowerCase() !== "india") {
      return NextResponse.json(
        {
          error:
            "HiddenHire V1 currently supports native jobs hiring candidates in India.",
        },
        { status: 400 }
      );
    }

    const currency = (body.currency || "INR").trim().toUpperCase();

    if (currency !== "INR") {
      return NextResponse.json(
        {
          error:
            "Native HiddenHire V1 jobs currently use INR salary ranges.",
        },
        { status: 400 }
      );
    }

    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      return NextResponse.json(
        { error: "Minimum salary cannot exceed maximum salary." },
        { status: 400 }
      );
    }

    if (experienceMin !== null && experienceMax !== null && experienceMin > experienceMax) {
      return NextResponse.json(
        { error: "Minimum experience cannot exceed maximum experience." },
        { status: 400 }
      );
    }

    const { data: employerProfile, error: employerProfileError } =
      await supabase
        .from("employer_profiles")
        .select("company_id")
        .eq("profile_id", user.id)
        .maybeSingle();

    if (profile.role === "employer" && employerProfileError) {
      return NextResponse.json(
        { error: "Unable to load your employer profile." },
        { status: 500 }
      );
    }

    let companyId = employerProfile?.company_id ?? null;

    if (!companyId) {
      const companyName = body.company?.trim() || "";

      if (!companyName) {
        return NextResponse.json(
          {
            error:
              "Company name is required before an employer can post a job.",
          },
          { status: 400 }
        );
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: companyName,
          country: "India",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (companyError || !company) {
        return NextResponse.json(
          {
            error: "Unable to create the company profile.",
          },
          { status: 500 }
        );
      }

      companyId = company.id;

      if (profile.role === "employer") {
        const { error: linkError } = await supabase
          .from("employer_profiles")
          .upsert(
            {
              profile_id: user.id,
              company_id: companyId,
            },
            { onConflict: "profile_id" }
          );

        if (linkError) {
          return NextResponse.json(
            {
              error:
                "Company was created, but your employer profile could not be linked.",
            },
            { status: 500 }
          );
        }
      }
    }

    const normalized = await normalizeJob({
      ...body,
      title,
      description,
      country,
      currency,
    });

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        company_id: companyId,
        posted_by: user.id,
        source_type: "native",
        title,
        description,
        job_function: jobFunction,
        location: body.city?.trim() || null,
        city: body.city?.trim() || null,
        region: body.region?.trim() || null,
        country: "India",
        remote: Boolean(body.remote),
        workplace_type: body.remote ? "Remote" : "On-site",
        salary_min:
          salaryMin,
        salary_max:
          salaryMax,
        currency,
        experience_min:
          experienceMin,
        experience_max:
          experienceMax,
        status: "pending_review",
        visibility: "standard",
      })
      .select(
  "id, company_id, posted_by, source_type, title, description, job_function, city, region, country, remote, workplace_type, salary_min, salary_max, currency, experience_min, experience_max, status, visibility, created_at"
)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: "Unable to create the job. Please try again.",
        },
        { status: 500 }
      );
    }

    const { data: candidates, error: candidateDiscoveryError } =
  await supabase.rpc(
    "recruiter_candidate_discovery_for_job",
    {
      p_job_id: job.id,
    }
  );

if (candidateDiscoveryError) {
  return NextResponse.json(
    {
      error: "Job was created, but candidate discovery failed.",
      job,
      aiNormalized: normalized,
    },
    { status: 500 }
  );
}

const { data: company, error: companyLookupError } = await supabase
  .from("companies")
  .select("name")
  .eq("id", job.company_id)
  .maybeSingle();

if (companyLookupError) {
  return NextResponse.json(
    {
      error: "Job was created, but company information could not be loaded.",
      job,
      aiNormalized: normalized,
    },
    { status: 500 }
  );
}

const recruiterJob = toRecruiterJob(
  job,
  company?.name || "HiddenHire",
  normalized.skills
);

const candidateMatches = (
  await Promise.all(
    (Array.isArray(candidates) ? candidates : []).map(
      async (candidate: RecruiterCandidateRow) => {
        const profile = toCandidateProfile(candidate);
        const match = calculateJobMatch(profile, recruiterJob);

        const { error: matchSaveError } = await supabase.rpc(
          "save_recruiter_match",
          {
            p_job_id: job.id,
            p_candidate_id: candidate.candidate_id,
            p_score: match.score,
            p_reasons: match.reasons,
            p_gaps: match.missingRequirements,
          }
        );

        if (matchSaveError) {
          throw new Error(
            "Unable to save candidate match."
          );
        }

        return {
          candidateId: candidate.candidate_id,
          name: candidate.full_name,
          headline: candidate.headline,
          score: match.score,
          opportunityScore: match.opportunityScore,
          matchTier: match.matchTier,
          roleClassification: match.roleClassification,
          reasons: match.reasons,
          missingRequirements: match.missingRequirements,
        };
      }
    )
  )
).sort(
  (a, b) =>
    b.score - a.score ||
    b.opportunityScore - a.opportunityScore
);

return NextResponse.json(
  {
    mode: "native",
    job,
    aiNormalized: normalized,
    candidateCount: candidateMatches.length,
    matches: candidateMatches,
  },
  { status: 201 }
);
} catch {
  return NextResponse.json(
    { error: "Job creation failed. Please try again." },
    { status: 500 }
  );
}
}