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
    description?: string | null;
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
    sampleAnswers: { question: string; draft: string; evidenceNeeded: string }[];
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
  const experience = input.candidate.experienceYears !== null && input.candidate.experienceYears !== undefined && Number.isFinite(Number(input.candidate.experienceYears))
    ? Number(input.candidate.experienceYears)
    : null;
  const status = clean(input.application.status, "applied").toLowerCase();
  const tokens = roleTokens(role);
  const description = clean(input.job.description).toLowerCase();
  const domainTerms = ["excel", "accounting", "reconciliation", "budgeting", "forecasting", "financial reporting", "taxation", "audit", "accounts payable", "accounts receivable", "cash flow", "variance analysis", "payroll", "compliance", "stakeholder management", "leadership", "salesforce", "sql", "power bi", "financial analysis", "month-end closing", "general ledger", "business development", "customer relationship", "project management", "data analysis", "communication"];
  const jobRequirements = unique([...tokens.filter((token) => description.includes(token.toLowerCase())), ...domainTerms.filter((term) => description.includes(term))]).slice(0, 6);
  const relevantSkills = skills.filter((skill) => jobRequirements.some((term) => term.includes(skill.toLowerCase()) || skill.toLowerCase().includes(term)));
  const focus = (relevantSkills.length ? relevantSkills : skills).slice(0, 5);

  const professionalSummary =
    clean(input.candidate.headline, experience !== null ? `${experience}-year professional` : "Professional candidate") +
    ` targeting ${role} opportunities. ` +
    (skills.length
      ? `Relevant profile skills include ${focus.slice(0, 4).join(", ")}. Highlight concrete examples and outcomes you can verify${companyKnown ? ` for ${company}` : ""}.`
      : "Add verified role-relevant skills and measurable achievements before using this summary.");

  const coverLetter = [
    "Dear Hiring Team,",
    "",
    `I am interested in the ${role} opportunity${companyKnown ? ` at ${company}` : ""}.`,
    skills.length
      ? `My profile lists ${focus.slice(0, 4).join(", ")}. I would welcome the opportunity to discuss specific examples of how these skills align with the requirements of the role.`
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

  const primaryResponsibility = jobRequirements[0] ?? focus[0] ?? `a core responsibility of the ${role} role`;
  const secondaryResponsibility = jobRequirements[1] ?? focus[1] ?? `a key day-to-day responsibility in this role`;
  const interviewPlan = {
    opening: `Prepare a concise introduction focused on your relevant responsibilities for the ${role} role, the skills you have actually used, and one result you can substantiate.`,
    stories: [
      `Prepare a specific example of how you handled ${primaryResponsibility} and what changed as a result.`,
      `Prepare an example of a challenge involving ${secondaryResponsibility}, explaining the steps you personally took.`,
      `Prepare an example that demonstrates collaboration with colleagues or stakeholders while delivering a role-related responsibility.`,
      `Review the tools, processes, and decisions you have personally handled that are relevant to ${role}.`,
    ],
    questions: [
      `What are the most important day-to-day responsibilities for the person in this ${role} position?`,
      `How does the team measure successful performance for ${primaryResponsibility}?`,
      `What tools, systems, or processes does the team use for ${secondaryResponsibility}?`,
    ],
    roleFocus: [
      skills.length
        ? `Prepare a verified example showing how you used ${focus.slice(0, 3).join(", ")} in your work.`
        : `Review the job description and identify role requirements supported by your actual experience.`,
      "Use concrete examples and numbers where you have verified evidence.",
      "Do not claim tools, responsibilities, qualifications or results that are not in your actual experience.",
    ],
    sampleAnswers: [
      {
        question: `Which responsibilities have you handled that best prepare you for this ${role} position?`,
        draft: `In my role at [company/team], I was responsible for [relevant responsibility]. I personally [describe the actions, tools, and decisions you handled]. This contributed to [verified outcome]. That experience is relevant to this position because it aligns with [specific responsibility from the job description].`,
        evidenceNeeded: "Add a real employer or project, the responsibility you owned, the actions you personally took, and an outcome you can verify.",
      },
      {
        question: `How would you approach ${primaryResponsibility} in this role?`,
        draft: `First, I would confirm the expected outcome, deadlines, and applicable process for ${primaryResponsibility}. I would review the relevant records and requirements, complete the work using the team's approved tools, and check the result for accuracy. I would raise discrepancies or risks early and keep the relevant stakeholders informed. I would adapt this approach to the team's procedures and the experience I can demonstrate.`,
        evidenceNeeded: "Replace this general approach with the actual tools, controls, and steps you know or have used. Do not claim experience you do not have.",
      },
      {
        question: `What experience do you have with ${secondaryResponsibility}?`,
        draft: `I have experience with [specific task or process] at [company/team]. My part was to [actions you personally completed], using [relevant system or tool]. The result was [verified outcome]. Where I have not used the team's exact process, I would learn the documented workflow and follow its review and approval controls.`,
        evidenceNeeded: `Provide a real example connected to ${secondaryResponsibility}, including your actions, relevant systems or tools, and a result you can substantiate.`,
      },
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
      ? focus.map((item) => `Prioritize ${item} only where your work history supports it; add a specific responsibility, tool or measurable outcome as evidence.`)
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
