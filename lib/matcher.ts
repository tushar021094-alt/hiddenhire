import type { Job, MatchResult } from "./types";

export type Profile = {
  role: string;
  skills: string[];
  experience: number;
  location: string;
  remoteOnly: boolean;
  minSalary: number;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+.# ]/g, " ");

export function matchJob(job: Job, profile: Profile): MatchResult {
  const haystack = normalize([job.title, job.description, ...job.skills].join(" "));
  const roleWords = normalize(profile.role).split(" ").filter(Boolean);
  const roleHits = roleWords.filter((word) => haystack.includes(word)).length;
  const roleScore = roleWords.length ? Math.min(40, (roleHits / roleWords.length) * 40) : 0;

  const skillHits = profile.skills.filter((skill) => haystack.includes(normalize(skill))).length;
  const skillScore = profile.skills.length ? Math.min(15, (skillHits / profile.skills.length) * 15) : 0;

  const locationScore = profile.remoteOnly
    ? job.remote && job.indiaEligible ? 10 : 0
    : job.indiaEligible ? 10 : 5;

  const salaryScore = job.salaryMin
    ? job.salaryMin >= profile.minSalary ? 10 : Math.max(0, 10 * (job.salaryMin / profile.minSalary))
    : 3;

  const seniorityScore = profile.experience >= 5 && /senior|manager|lead|director/i.test(job.title) ? 5 : 3;
  const companyScore = job.indiaEligible ? 5 : 1;
  const score = Math.round(Math.min(100, roleScore + skillScore + locationScore + salaryScore + seniorityScore + companyScore));

  const reasons = [
    roleHits ? `Role overlap: ${roleHits}/${roleWords.length} target terms` : "Limited direct role-title overlap",
    skillHits ? `${skillHits} requested skills appear in the job` : "Few requested skills detected",
    job.remote && job.indiaEligible ? "Remote and India eligibility detected" : "Remote/India eligibility needs verification",
    job.salaryMin && job.salaryMin >= profile.minSalary ? "Published salary meets your minimum" : "Salary is below target or not disclosed",
  ];

  const gaps = [
    ...(job.salaryMin && job.salaryMin < profile.minSalary ? ["Compensation below target"] : []),
    ...(!job.indiaEligible ? ["India eligibility not confirmed"] : []),
    ...(skillHits < Math.min(2, profile.skills.length) ? ["Skill overlap is limited"] : []),
  ];

  return { ...job, score, reasons, gaps };
}