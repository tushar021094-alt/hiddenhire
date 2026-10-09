export type CareerExecutionMode = "application" | "follow_up" | "interview";

export type CareerExecutionInput = {
  candidate: {
    name?: string | null;
    headline?: string | null;
    targetRole?: string | null;
    experienceYears?: number | null;
    skills: string[];
    location?: string | null;
  };
  application: {
    id: string;
    status: string;
    createdAt: string;
    updatedAt?: string | null;
  };
  job: {
    title?: string | null;
    company?: string | null;
    location?: string | null;
    applicationUrl?: string | null;
  };
};

export type CareerExecutionPackage = {
  mode: CareerExecutionMode;
  applicationId: string;
  role: string;
  company: string;
  location: string;
  resumeFocus: string[];
  professionalSummary: string;
  coverLetter: string;
  followUpMessage: string;
  interviewPlan: {
    opening: string;
    stories: string[];
    questions: string[];
    roleFocus: string[];
  };
  checklist: string[];
  approval: {
    required: boolean;
    submission: string;
    communication: string;
  };
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function roleTokens(role: string) {
  const stopWords = new Set(["the", "and", "for", "with", "from", "into", "your", "role", "position", "manager", "senior", "junior", "lead", "executive", "specialist"]);
  return role
    .split(/[^a-zA-Z0-9+#/&-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token.toLowerCase()))
    .slice(0, 6);
}

export function buildCareerExecutionPackage(input: CareerExecutionInput): CareerExecutionPackage {
  const role = clean(input.job.title, input.candidate.targetRole || "the role");
  const companyKnown = Boolean(input.job.company?.trim());
  const company = clean(input.job.company, "Employer not listed");
  const location = clean(input.job.location, input.candidate.location || "the listed location");
  const name = clean(input.candidate.name, "Candidate");
  const skills = unique(input.candidate.skills).slice(0, 8);
  const experience = Number.isFinite(Number(input.candidate.experienceYears))
    ? Number(input.candidate.experienceYears)
    : null;
  const status = clean(input.application.status, "applied").toLowerCase();
  const tokens = roleTokens(role);
  const focus = skills.slice(0, 5);

  const professionalSummary =
    clean(input.candidate.headline, experience !== null ? `${experience}-year professional` : "Professional candidate") +
    ` targeting ${role} opportunities. ` +
    (skills.length
      ? `Relevant profile skills include ${skills.slice(0, 4).join(", ")}. Highlight concrete examples and outcomes you can verify${companyKnown ? ` for ${company}` : ""}.`
      : "Add verified role-relevant skills and measurable achievements before using this summary.");

  const coverLetter = [
    "Dear Hiring Team,",
    "",
    `I am interested in the ${role} opportunity${companyKnown ? ` at ${company}` : ""}.`,
    skills.length
      ? `My profile lists ${skills.slice(0, 4).join(", ")}. I would welcome the opportunity to discuss specific examples of how these skills align with the requirements of the role.`
      : "I would welcome the opportunity to discuss how my background aligns with the requirements of this role. I will use examples grounded in my verified experience.",
    "",
    "I would appreciate the opportunity to discuss the position and the contribution I could make. I will be glad to share relevant examples and measurable results from my work history.",
    "",
    "Regards,",
    name,
  ].join("\n");

  const followUpMessage = [
    "Subject: Follow-up — " + role,
    "",
    `Hi Hiring Team,`,
    "",
    `I’m following up on my application for the ${role} position${companyKnown ? ` at ${company}` : ""}. I remain very interested in the opportunity and would be happy to provide any additional information that would help with the review.`,
    "",
    "Thank you for your consideration.",
    "",
    name,
  ].join("\n");

  const interviewPlan = {
    opening: `Prepare a 60-second introduction connecting your background to ${role}, with one verified measurable result rather than a generic career summary.`,
    stories: [
      "Prepare one STAR story showing ownership and measurable impact.",
      "Prepare one STAR story showing problem-solving under pressure.",
      "Prepare one STAR story showing collaboration or stakeholder management.",
      "Prepare one role-specific example that demonstrates the strongest relevant skill.",
    ],
    questions: [
      `What would success look like in the first 90 days for this ${role}?`,
      "Which outcomes or metrics matter most for this position?",
      "What is the biggest challenge the person joining this role will need to solve?",
    ],
    roleFocus: [
      skills.length
        ? `Prepare a verified example showing how you used ${skills.slice(0, 3).join(", ")} in your work.`
        : `Review the job description and identify role requirements supported by your actual experience.`,
      "Use concrete examples and numbers where you have verified evidence.",
      "Do not claim tools, responsibilities, qualifications or results that are not in your actual experience.",
    ],
  };

  const checklist = [
    "Review the live job description immediately before submission.",
    "Keep only verified experience, skills and achievements in the final resume.",
    "Move the strongest role-relevant evidence into the top third of the resume.",
    "Review the cover-letter draft and personalize it before sending.",
    status === "interview"
      ? "Complete interview preparation and confirm the interview time and format."
      : status === "applied" || status === "reviewing" || status === "shortlisted"
        ? "Check the application status and recruiter communication before following up."
        : "Confirm the correct application route before taking action.",
  ];

  const mode: CareerExecutionMode = status === "interview"
    ? "interview"
    : status === "applied" || status === "reviewing" || status === "shortlisted"
      ? "follow_up"
      : "application";

  return {
    mode,
    applicationId: input.application.id,
    role,
    company,
    location,
    resumeFocus: focus.length
      ? focus.map((item) => `If supported by your work history, show a concrete example demonstrating ${item}.`)
      : ["Add verified role-relevant skills and concrete achievements from your actual work history before tailoring the resume."],
    professionalSummary,
    coverLetter,
    followUpMessage,
    interviewPlan,
    checklist,
    approval: {
      required: true,
      submission: "HiddenHire prepares the package; you review and submit the application yourself.",
      communication: "Recruiter messages are drafts only. You must review and approve before sending.",
    },
  };
}
