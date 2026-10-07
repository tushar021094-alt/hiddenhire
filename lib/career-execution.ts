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
  return role
    .split(/[^a-zA-Z0-9+#/&-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);
}

export function buildCareerExecutionPackage(input: CareerExecutionInput): CareerExecutionPackage {
  const role = clean(input.job.title, input.candidate.targetRole || "the role");
  const company = clean(input.job.company, "the company");
  const location = clean(input.job.location, input.candidate.location || "the listed location");
  const name = clean(input.candidate.name, "Candidate");
  const skills = unique(input.candidate.skills).slice(0, 8);
  const experience = Number.isFinite(Number(input.candidate.experienceYears))
    ? Number(input.candidate.experienceYears)
    : null;
  const status = clean(input.application.status, "applied").toLowerCase();
  const tokens = roleTokens(role);
  const focus = unique([...tokens, ...skills]).slice(0, 8);

  const professionalSummary =
    clean(input.candidate.headline, experience !== null ? `${experience}-year professional` : "Experienced professional") +
    ` targeting ${role} opportunities. For ${company}, lead with verified experience, measurable outcomes and evidence across ${focus.slice(0, 4).join(", ") || "the role's core requirements"}.`;

  const coverLetter = [
    "Dear Hiring Team,",
    "",
    `I am interested in the ${role} opportunity at ${company}. My background is aligned with the role through my experience in ${skills.slice(0, 4).join(", ") || "relevant professional responsibilities"}.`,
    "",
    `I would welcome the opportunity to discuss how my experience can contribute to ${company}. I have focused this application on the requirements of the role and can provide specific examples and measurable results during the hiring process.`,
    "",
    "Regards,",
    name,
  ].join("\n");

  const followUpMessage = [
    "Subject: Follow-up — " + role,
    "",
    `Hi Hiring Team,`,
    "",
    `I’m following up on my application for the ${role} position at ${company}. I remain very interested in the opportunity and would be happy to provide any additional information that would help with the review.`,
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
      `Explain how your experience maps to ${tokens.slice(0, 3).join(", ") || "the role requirements"}.`,
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
      ? focus.map((item) => `Keep verified evidence for ${item} prominent.`)
      : ["Keep the strongest verified role-relevant achievements prominent."],
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
