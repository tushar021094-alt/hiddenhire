import type { Job, MatchResult, SearchFilters } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+.#& ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string) => normalize(value).split(" ").filter(token => token.length > 1);
const roleAliases: Record<string, string[]> = {
  finance: ["finance","financial"], manager: ["manager","management","lead"], analyst: ["analyst","analysis"],
  fp: ["fp&a","fpa","planning","forecasting"], accounting: ["accounting","accountant","accounts"],
};
function roleMatch(role: string, title: string, description: string) {
  const requested = tokens(role); const haystack = normalize(`${title} ${description}`);
  return { hits: requested.filter(word => (roleAliases[word] ?? [word]).some(alias => haystack.includes(normalize(alias)))), total: requested.length };
}
function skillMatch(skills: string[], job: Job) {
  const haystack = normalize([job.title, job.description, ...job.skills].join(" "));
  return skills.filter(skill => { const n = normalize(skill); return n && (haystack.includes(n) || tokens(skill).some(t => t.length > 2 && haystack.includes(t))); });
}
export function matchJob(job: Job, profile: SearchFilters): MatchResult {
  const role = roleMatch(profile.role, job.title, job.description); const matchedSkills = skillMatch(profile.skills, job);
  const roleScore = role.total ? Math.min(40, role.hits.length / role.total * 40) : 0;
  const skillScore = profile.skills.length ? Math.min(15, matchedSkills.length / profile.skills.length * 15) : 0;
  const locationScore = profile.market === "india" ? (job.indiaEligible ? 10 : 0) : 10;
  const salaryScore = job.salaryUsdMin ? Math.min(10, Math.max(0, job.salaryUsdMin / Math.max(profile.minCtc, 1) * 10)) : 4;
  const seniorityScore = /director|head|vp|vice president/i.test(job.title) && profile.experience < 7 ? 2 : /manager|senior|lead|director|head/i.test(job.title) ? 5 : 3;
  const companyScore = job.country ? 5 : 2;
  const score = Math.round(Math.min(100, roleScore + skillScore + locationScore + salaryScore + seniorityScore + companyScore));
  const reasons = [
    role.hits.length ? `Role alignment: ${role.hits.length}/${role.total} target terms` : "Limited direct role alignment",
    matchedSkills.length ? `${matchedSkills.length} of your skills appear relevant` : "Few matching skills detected",
    job.remote ? "Remote work detected" : job.workplaceType === "Hybrid" ? "Hybrid work detected" : "On-site role",
    job.salaryMin ? "Published compensation detected" : "Salary not disclosed; verify compensation on the employer page",
  ];
  const gaps = [
    ...(job.salaryUsdMin && job.salaryUsdMin < profile.minCtc ? ["Compensation below target"] : []),
    ...(profile.market === "india" && !job.indiaEligible ? ["India eligibility not confirmed"] : []),
    ...(matchedSkills.length < Math.min(2, profile.skills.length) ? ["Skill overlap is limited"] : []),
  ];
  return { ...job, score, reasons, gaps };
}