import type { Job, MatchResult, SearchFilters } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+.#& ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string) => normalize(value).split(" ").filter(token => token.length > 1);

const roleAliases: Record<string, string[]> = {
  finance: ["finance", "financial"],
  manager: ["manager", "management", "lead"],
  analyst: ["analyst", "analysis"],
  fp: ["fp&a", "fpa", "planning", "forecasting", "financial planning"],
  fpa: ["fp&a", "fpa", "planning", "forecasting", "financial planning"],
  accounting: ["accounting", "accountant", "accounts"],
  ap: ["accounts payable", "payables"],
  ar: ["accounts receivable", "receivables"],
  "accounts payable": ["accounts payable", "payables"],
  "accounts receivable": ["accounts receivable", "receivables"],
  "accounts payable manager": ["accounts payable manager", "accounts payable", "payables"],
  "accounts receivable manager": ["accounts receivable manager", "accounts receivable", "receivables"],
  "finance operations": ["finance operations", "financial operations"],
  "financial controller": ["financial controller", "controller", "controllership"],
  "financial planning and analysis": ["financial planning and analysis", "fp&a", "fpa"],
};

function containsTerm(haystack: string, term: string) {
  const n = normalize(term);
  if (!n) return false;
  return new RegExp(`(^|\\s)${n.replace(/[.*+?^{}()|[\\]\\\\]/g, "\\$&")}(?=\\s|$)`, "i").test(haystack);
}

function aliasesFor(requested: string) {
  const normalized = normalize(requested);
  return roleAliases[normalized] ?? [normalized];
}

function roleMatch(role: string, title: string, description: string) {
  const normalizedRole = normalize(role);
  const requested = tokens(normalizedRole);
  const titleText = normalize(title);
  const descriptionText = normalize(description);
  const exactTitle = containsTerm(titleText, normalizedRole);
  const hits = requested.filter(word => aliasesFor(word).some(alias => containsTerm(titleText, alias) || containsTerm(descriptionText, alias)));
  const titleHits = requested.filter(word => aliasesFor(word).some(alias => containsTerm(titleText, alias)));
  const descriptionHits = requested.filter(word => !titleHits.includes(word) && aliasesFor(word).some(alias => containsTerm(descriptionText, alias)));
  const phraseHits = aliasesFor(normalizedRole).some(alias => containsTerm(titleText, alias));
  return { hits, titleHits, descriptionHits, total: Math.max(requested.length, 1), exactTitle, phraseHits };
}

function skillMatch(skills: string[], job: Job) {
  const haystack = normalize([job.title, job.description, ...job.skills].join(" "));
  return skills.filter(skill => {
    const n = normalize(skill);
    return n && (containsTerm(haystack, n) || tokens(skill).some(t => t.length > 2 && containsTerm(haystack, t)));
  });
}

export function matchJob(job: Job, profile: SearchFilters): MatchResult {
  const role = roleMatch(profile.role, job.title, job.description);
  const matchedSkills = skillMatch(profile.skills, job);

  // Title relevance is deliberately weighted much more heavily than generic
  // description mentions. This prevents an Accounts Payable search from
  // returning unrelated finance/IT roles that merely mention "AP".
  const roleScore = role.total
    ? Math.min(40, (role.titleHits.length / role.total) * 32 + (role.descriptionHits.length / role.total) * 8)
    : 0;
  const skillScore = profile.skills.length ? Math.min(15, matchedSkills.length / profile.skills.length * 15) : 0;
  const locationScore = profile.market === "india" ? (job.indiaEligible ? 10 : 0) : 10;
  const salaryScore = job.salaryUsdMin ? Math.min(10, Math.max(0, job.salaryUsdMin / Math.max(profile.minCtc, 1) * 10)) : 4;
  const seniorityScore = /director|head|vp|vice president/i.test(job.title) && profile.experience < 7 ? 2 : /manager|senior|lead|director|head/i.test(job.title) ? 5 : 3;
  const companyScore = job.country ? 5 : 2;
  const score = Math.round(Math.min(100, roleScore + skillScore + locationScore + salaryScore + seniorityScore + companyScore));

  const reasons = [
    role.phraseHits || role.exactTitle ? "Direct title/role match" : role.titleHits.length ? `Role terms in title: ${role.titleHits.length}/${role.total}` : "Limited direct role alignment",
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

export function isRoleRelevant(job: Job, profile: SearchFilters) {
  const role = roleMatch(profile.role, job.title, job.description);
  // A requested role must be represented in the title, not only somewhere in
  // the description. Description-only matches are too noisy for job search.
  return role.phraseHits || role.exactTitle || role.titleHits.length > 0;
}