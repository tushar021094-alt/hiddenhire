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
      jobRequirements.length
        ? `The job description emphasizes ${jobRequirements.slice(0, 3).join(", ")}. Which of these is most important in the first 90 days?`
        : "Which outcomes or metrics matter most for this position?",
      jobRequirements.length
        ? `How does the team currently measure success for ${jobRequirements[0]}?`
        : "What is the biggest challenge the person joining this role will need to solve?",
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
        question: `Tell me about yourself and why you fit the ${role} role.`,
        draft: `I am a professional targeting ${role}${experience !== null ? ` with ${experience} years of experience` : ""}. My profile highlights ${focus.length ? focus.join(", ") : "skills relevant to this role"}. One example that demonstrates my fit is [describe a real responsibility or project], where I [explain your specific contribution] and achieved [verified outcome]. I am interested in this role because [connect your experience to a requirement in the job description].`,
        evidenceNeeded: "Add one real responsibility or project, your personal contribution, a verifiable result, and the job requirement it supports.",
      },
      {
        question: "Describe a time you solved a difficult problem (STAR).",
        draft: "Situation: [Describe the real work situation and context].\\nTask: [What were you responsible for?]\\nAction: [List the steps you personally took, tools used, and people you worked with].\\nResult: [State the verified outcome; include a metric only if you can substantiate it].\\nLearning: [What would you repeat or improve next time?]",
        evidenceNeeded: "Fill every STAR section with a real example. Do not leave a placeholder in the final answer or invent numbers.",
      },
      {
        question: `How have you used ${focus[0] ?? "a relevant skill"} to deliver results?`,
        draft: `In my work at [company/team], I used ${focus[0] ?? "the relevant skill"} to [specific task or problem]. My responsibility was [your role]. I took these actions: [steps you personally completed]. The result was [verified outcome or measurable result]. This is relevant to the ${role} role because [link to a stated job requirement].`,
        evidenceNeeded: `Provide the employer or project, task, your personal actions, and a verified outcome involving ${focus[0] ?? "the relevant skill"}.`,
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
