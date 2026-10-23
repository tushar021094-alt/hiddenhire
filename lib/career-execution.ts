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

  const responsibilityLabels: Record<string, string> = {
    excel: "Excel-based reporting and analysis",
    accounting: "accounting processes",
    reconciliation: "account reconciliations",
    budgeting: "budget preparation and monitoring",
    forecasting: "financial forecasting",
    "financial reporting": "financial reporting",
    taxation: "tax compliance and preparation",
    audit: "audit preparation and controls",
    "accounts payable": "accounts payable processing",
    "accounts receivable": "accounts receivable and collections",
    "cash flow": "cash-flow monitoring",
    "variance analysis": "variance analysis",
    payroll: "payroll processing and controls",
    compliance: "financial compliance and controls",
    "stakeholder management": "stakeholder coordination",
    leadership: "team leadership and task prioritisation",
    salesforce: "Salesforce workflows",
    sql: "SQL queries and data analysis",
    "power bi": "Power BI reporting and dashboards",
    "financial analysis": "financial analysis",
    "month-end closing": "month-end close activities",
    "general ledger": "general ledger maintenance",
    "business development": "business development activities",
    "customer relationship": "customer relationship management",
    "project management": "project planning and delivery",
    "data analysis": "data analysis and reporting",
    communication: "stakeholder communication",
  };
  const responsibilityPhrase = (term: string | undefined) =>
    term ? responsibilityLabels[term.toLowerCase()] ?? term : `core responsibilities of the ${role} role`;
  const roleRelevantTerms = unique([
    ...domainTerms.filter((term) => description.includes(term)),
    ...focus,
  ]);
  const primaryResponsibility = responsibilityPhrase(roleRelevantTerms[0]);
  const secondaryResponsibility = responsibilityPhrase(roleRelevantTerms[1] ?? roleRelevantTerms[0]);
  const interviewPlan = {
    opening: `Prepare a concise introduction focused on responsibilities relevant to the ${role} role, the tools and skills you have actually used, and one outcome you can substantiate.`,
    stories: [
      `Prepare a real example of delivering ${primaryResponsibility}. Be ready to explain your responsibility, the steps you took, and the verified outcome.`,
      `Prepare a real example of resolving an issue while handling ${secondaryResponsibility}, including the checks or controls you used.`,
      `Prepare an example of meeting a deadline while maintaining accuracy in ${primaryResponsibility}.`,
      `Prepare an example of coordinating with a colleague or stakeholder to complete work related to ${secondaryResponsibility}.`,
    ],
    questions: [
      `Which deliverables are most important for the ${role} role during a typical week or month?`,
      `How does the team measure the accuracy, timeliness, and quality of ${primaryResponsibility}?`,
      `Which systems, reports, or approval controls are used for ${secondaryResponsibility}?`,
    ],
    roleFocus: [
      skills.length
        ? `Prepare a verified work example involving ${focus.slice(0, 3).join(", ")} and explain your personal contribution.`
        : `Review the job description and select responsibilities supported by your actual experience.`,
      "Use concrete outcomes only where you can verify them.",
      "Do not claim tools, responsibilities, qualifications or results that are not part of your actual experience.",
    ],
    sampleAnswers: [
      {
        question: `How have you handled ${primaryResponsibility} in a previous role?`,
        draft: `At [company/team], I handled [specific task related to ${primaryResponsibility}]. I was responsible for [your responsibility] and personally [actions and tools you used]. This led to [verified outcome]. For the ${role} position, I would apply the relevant experience to [related duty from the job description].`,
        evidenceNeeded: `Provide the employer or project, the task, your own actions, and an outcome you can verify for ${primaryResponsibility}. Replace every bracketed prompt before using the answer.`,
      },
      {
        question: `How would you maintain accuracy and meet deadlines while handling ${secondaryResponsibility}?`,
        draft: `I would first confirm the required output, deadline, source records, and review process for ${secondaryResponsibility}. I would follow the team's documented workflow, check the work against source data or agreed controls, record any discrepancies, and escalate exceptions promptly. I would use [relevant tool or control you have actually used] and confirm completion against the team's criteria.`,
        evidenceNeeded: "Replace the bracketed tool or control with something you know or have used. Keep the answer aligned with the employer's actual process.",
      },
      {
        question: `What checks would you use to review work related to ${primaryResponsibility}?`,
        draft: `I would compare the result with the source data and defined requirements, check for missing or inconsistent entries, validate key calculations or totals where applicable, and follow the required review or approval process. In practice, I would use [specific check or system you have used] and document or escalate any unresolved difference.`,
        evidenceNeeded: `Add a relevant check, system, or control that you have genuinely used, and explain how it helped you identify or prevent an error.`,
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
