export type ApplicationPreparationInput = {
  targetRole: string; company: string; location: string;
  candidate: { headline?: string | null; targetRole?: string | null; experienceYears?: number | null; skills: string[]; country?: string | null };
  job: { description?: string | null; requiredSkills?: string[]; requiredExperience?: number | null; industry?: string | null; source?: string | null };
};

function clean(value: unknown, fallback = "") { return typeof value === "string" ? value.trim() : fallback; }
function unique(items: string[]) { return [...new Set(items.map((item) => item.trim()).filter(Boolean))]; }
function skillMatches(candidateSkills: string[], requiredSkills: string[]) {
  const normalized = candidateSkills.map((skill) => skill.toLowerCase());
  return unique(requiredSkills).filter((skill) => normalized.some((candidate) => candidate.includes(skill.toLowerCase()) || skill.toLowerCase().includes(candidate)));
}
function firstSentences(text: string, max = 500) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length <= max ? normalized : normalized.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function buildApplicationPreparation(input: ApplicationPreparationInput) {
  const role = clean(input.targetRole, "the role");
  const company = clean(input.company, "the company");
  const candidateSkills = unique(input.candidate.skills);
  const requiredSkills = unique(input.job.requiredSkills ?? []);
  const matchedSkills = skillMatches(candidateSkills, requiredSkills);
  const missingSkills = requiredSkills.filter((skill) => !matchedSkills.includes(skill));
  const experienceYears = Number.isFinite(Number(input.candidate.experienceYears)) ? Number(input.candidate.experienceYears) : null;
  const requiredExperience = Number.isFinite(Number(input.job.requiredExperience)) ? Number(input.job.requiredExperience) : null;
  const experienceFit = requiredExperience === null || experienceYears === null
    ? "Review the experience requirement manually."
    : experienceYears >= requiredExperience
      ? "Your stated experience (" + experienceYears + " years) meets the listed requirement (" + requiredExperience + "+ years)."
      : "The role lists " + requiredExperience + "+ years; your profile currently shows " + experienceYears + " years. Verify fit before applying.";
  const summaryBase = clean(input.candidate.headline) || ((experienceYears ?? "Experienced") + "-year professional targeting " + role + " opportunities.");
  const focusSkills = (matchedSkills.length ? matchedSkills : candidateSkills).slice(0, 6);
  const professionalSummary = summaryBase.replace(/[.]+$/, "") + ". For " + role + " at " + company + ", emphasize " + (focusSkills.join(", ") || "the skills most relevant to the job description") + " and quantify your strongest relevant results without adding claims that are not supported by your experience.";
  const coverLetter = [
    "Dear Hiring Team,",
    "",
    "I am interested in the " + role + " opportunity at " + company + ". My background aligns with the role through my experience in " + (focusSkills.join(", ") || "relevant professional responsibilities") + ".",
    "",
    "I would welcome the opportunity to discuss how my experience can contribute to the team. I have tailored my application to the requirements of this role and can provide additional context on relevant projects, responsibilities, and measurable results.",
    "",
    "Regards,",
    "Candidate",
  ].join("\n");
  return {
    role, company, location: clean(input.location, "Location not specified"), source: clean(input.job.source), matchedSkills, missingSkills, experienceFit, professionalSummary, coverLetter,
    requirementChecklist: [
      "Replace generic statements with 2–3 verified, measurable achievements from your actual experience.",
      "Make the first third of the resume mirror the most important requirements without keyword stuffing.",
      ...requiredSkills.slice(0, 8).map((skill) => matchedSkills.includes(skill) ? "Keep evidence for " + skill + " prominent." : "Verify whether you can credibly demonstrate " + skill + " before highlighting it."),
      experienceFit, "Review the employer and final job description immediately before submission.",
    ],
    jobDescriptionSnapshot: firstSentences(input.job.description ?? ""),
  };
}