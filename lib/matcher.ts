import type { Job, MatchResult } from "./types";

export type Profile = {
  role: string;
  skills: string[];
  experience: number;
  location: string;
  remoteOnly: boolean;
  minSalary: number;
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+.#& ]/g, " ").replace(/\s+/g, " ").trim();

const tokens = (value: string) => normalize(value).split(" ").filter((token) => token.length > 1);

const roleAliases: Record<string, string[]> = {
  finance: ["finance", "financial"],
  manager: ["manager", "management", "lead"],
  analyst: ["analyst", "analysis"],
  fp: ["fp&a", "fpa", "planning", "forecasting"],
  accounting: ["accounting", "accountant", "accounts"],
};

function roleMatch(profileRole: string, jobTitle: string, description: string) {
  const requested = tokens(profileRole);
  const haystack = normalize(`${jobTitle} ${description}`);
  const hits = requested.filter((word) => {
    const aliases = roleAliases[word] ?? [word];
    return aliases.some((alias) => haystack.includes(normalize(alias)));
  });
  return { hits, total: requested.length };
}

function skillMatch(skills: string[], job: Job) {
  const haystack = normalize([job.title, job.description, ...job.skills].join(" "));
  const hits = skills.filter((skill) => {
    const normalized = normalize(skill);
    return normalized && (haystack.includes(normalized) || tokens(skill).some((token) => token.length > 2 && haystack.includes(token)));
  });
  return hits;
}

export function matchJob(job: Job, profile: Profile): MatchResult {
  const role = roleMatch(profile.role, job.title, job.description);
  const matchedSkills = skillMatch(profile.skills, job);

  const roleScore = role.total ? Math.min(40, (role.hits.length / role.total) * 40) : 0;
  const skillScore = profile.skills.length ? Math.min(15, (matchedSkills.length / profile.skills.length) * 15) : 0;

  const locationScore = profile.remoteOnly
    ? (job.remote && job.indiaEligible ? 10 : 0)
    : (job.indiaEligible ? 10 : 0);

  const salaryScore = job.salaryMin
    ? job.salaryMin >= profile.minSalary
      ? 10
      : Math.max(0, Math.round(10 * (job.salaryMin / Math.max(profile.minSalary, 1))))
    : 4;

  const seniorityScore = /director|head|vp|vice president/i.test(job.title) && profile.experience < 7
    ? 2
    : /manager|senior|lead|director|head/i.test(job.title)
      ? 5
      : 3;

  const companyScore = job.indiaEligible ? 5 : 0;
  const score = Math.round(Math.min(100, roleScore + skillScore + locationScore + salaryScore + seniorityScore + companyScore));

  const reasons = [
    role.hits.length ? `Role alignment: ${role.hits.length}/${role.total} target terms` : "Limited direct role alignment",
    matchedSkills.length ? `${matchedSkills.length} of your skills appear relevant` : "Few matching skills detected",
    job.remote && job.indiaEligible ? "Remote work with India eligibility detected" : "Work-location eligibility needs verification",
    job.salaryMin
      ? job.salaryMin >= profile.minSalary ? "Published salary meets your minimum" : "Published salary is below your minimum"
      : "Salary not disclosed; verify compensation on the employer page",
  ];

  const gaps = [
    ...(job.salaryMin && job.salaryMin < profile.minSalary ? ["Compensation below target"] : []),
    ...(!job.indiaEligible ? ["India eligibility not confirmed"] : []),
    ...(matchedSkills.length < Math.min(2, profile.skills.length) ? ["Skill overlap is limited"] : []),
  ];

  return { ...job, score, reasons, gaps };
}
