import type { CandidateProfile, Job, MatchResult, MatchTier } from './job-types';

const normalizeSkill = (value: string) => value.toLowerCase().trim();

export type JobFunction =
  | 'Finance' | 'Accounting' | 'FP&A' | 'Audit' | 'Tax' | 'Treasury' | 'Risk'
  | 'Operations' | 'Engineering' | 'Software' | 'Data' | 'Product' | 'Marketing'
  | 'Sales' | 'HR' | 'Legal' | 'Customer Success' | 'Design' | 'Other';

const functionSignals: Array<{ functionName: JobFunction; terms: string[] }> = [
  { functionName: 'FP&A', terms: ['fp&a', 'financial planning', 'financial planning and analysis', 'forecasting', 'budgeting', 'variance analysis'] },
  { functionName: 'Accounting', terms: ['accounting', 'accountant', 'accounts payable', 'accounts receivable', 'ap/ar', 'general ledger', 'month-end close', 'month end close', 'controllership', 'management accounts'] },
  { functionName: 'Finance', terms: ['finance', 'financial reporting', 'financial analysis', 'p&l', 'balance sheet', 'management reporting', 'financial controls', 'accounting operations'] },
  { functionName: 'Audit', terms: ['audit', 'auditing'] },
  { functionName: 'Tax', terms: ['tax', 'vat', 'gst'] },
  { functionName: 'Treasury', terms: ['treasury', 'cash management'] },
  { functionName: 'Risk', terms: ['risk', 'underwriting', 'compliance'] },
  { functionName: 'Engineering', terms: ['engineering', 'software engineer', 'machine learning', 'devops', 'sre', 'infrastructure', 'automation engineer'] },
  { functionName: 'Software', terms: ['software', 'developer', 'programmer'] },
  { functionName: 'Data', terms: ['data science', 'data analyst', 'data engineering', 'analytics'] },
  { functionName: 'Product', terms: ['product manager', 'product management', 'product operations'] },
  { functionName: 'Marketing', terms: ['marketing', 'social media', 'brand', 'growth marketing'] },
  { functionName: 'Sales', terms: ['sales', 'account executive', 'business development', 'partnerships', 'partner development'] },
  { functionName: 'HR', terms: ['human resources', 'hr ', 'recruiting', 'recruiter', 'people partner', 'talent'] },
  { functionName: 'Legal', terms: ['legal', 'counsel', 'attorney'] },
  { functionName: 'Customer Success', terms: ['customer success', 'customer support', 'customer engineering'] },
  { functionName: 'Design', terms: ['design', 'ux', 'user experience'] },
  { functionName: 'Operations', terms: ['operations', 'business operations', 'program manager', 'project manager'] },
];

const financeFunctions = new Set<JobFunction>(['Finance', 'Accounting', 'FP&A', 'Audit', 'Tax', 'Treasury', 'Risk']);
const financeSignals = functionSignals.find((group) => group.functionName === 'Finance')!.terms
  .concat(functionSignals.find((group) => group.functionName === 'Accounting')!.terms)
  .concat(functionSignals.find((group) => group.functionName === 'FP&A')!.terms);

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|nbsp|quot|#39|lt|gt);/gi, ' ').toLowerCase();
}

function countSignals(text: string, signals: string[]): number {
  return signals.filter((signal) => text.includes(signal)).length;
}

export function classifyJobFunction(title: string, description = ''): JobFunction {
  const titleText = cleanText(title);
  const descriptionText = cleanText(description);
  if (/software engineer|machine learning engineer|forward deployed engineer|automation engineer|data engineer|devops|site reliability engineer|\bsre\b|infrastructure engineer|customer engineer/i.test(titleText)) return 'Engineering';
  if (/product manager|product management/i.test(titleText)) return 'Product';
  if (/marketing|social media/i.test(titleText)) return 'Marketing';
  if (/human resources|\bhr\b|recruiting|recruiter|people partner|talent partner/i.test(titleText)) return 'HR';
  if (/sales|account executive|business development|partner development/i.test(titleText)) return 'Sales';
  let bestFunction: JobFunction = 'Other';
  let bestScore = 0;

  for (const group of functionSignals) {
    const score = countSignals(titleText, group.terms) * 5 + Math.min(countSignals(descriptionText, group.terms), 4);
    if (score > bestScore) {
      bestScore = score;
      bestFunction = group.functionName;
    }
  }
  return bestFunction;
}

function calculateRoleRelevance(candidate: CandidateProfile, job: Job): { score: number; functionName: JobFunction } {
  const targetFunction = classifyJobFunction(candidate.targetJobTitle);
  const jobFunction = classifyJobFunction(job.title, job.description);
  const titleText = cleanText(job.title);
  const targetText = cleanText(candidate.targetJobTitle);
  const titleWords = new Set(targetText.split(/\s+/).filter((word) => word.length > 2));
  const titleOverlap = titleText.split(/\s+/).filter((word) => titleWords.has(word)).length;
  const exactOrContained = titleText === targetText ? 100 : titleText.includes(targetText) || targetText.includes(titleText) ? 92 : Math.min(80, titleOverlap * 15 + 35);
  const financeTitleScore = /finance|fp&a|controller|accounting manager|accountant|financial reporting|treasury|audit|tax/i.test(titleText)
    ? /accountant|analyst/i.test(titleText) ? 70 : 88
    : /business partner|commercial/i.test(titleText) && financeFunctions.has(jobFunction) ? 62 : exactOrContained;
  const titleScore = targetFunction === 'Finance' ? Math.max(exactOrContained, financeTitleScore) : exactOrContained;
  const functionScore = jobFunction === targetFunction ? 100 : targetFunction === 'Finance' && financeFunctions.has(jobFunction) ? 78 : 8;
  const descriptionScore = targetFunction === 'Finance' || financeFunctions.has(targetFunction)
    ? Math.min(100, countSignals(cleanText(`${job.title} ${job.description}`), financeSignals) * 14)
    : Math.min(100, countSignals(cleanText(`${job.title} ${job.description}`), functionSignals.find((group) => group.functionName === targetFunction)?.terms ?? []) * 20);
  const seniorityScore = /chief|vice president|vp|director|head|lead|manager|senior/i.test(job.title) ? 100 : 65;
  if (exactOrContained === 100 && jobFunction === targetFunction) return { score: 100, functionName: jobFunction };
  if (targetFunction === 'Finance' && financeFunctions.has(jobFunction) && /finance\s*(?:&|and)?\s*accounting manager|senior finance manager|fp&a manager|financial controller|accounting manager|finance lead|financial reporting manager|regional finance manager/i.test(titleText)) {
    return { score: 92, functionName: jobFunction };
  }
  let score = Math.round(titleScore * 0.5 + functionScore * 0.25 + descriptionScore * 0.2 + seniorityScore * 0.05);
  if (targetFunction === 'Finance' && !financeFunctions.has(jobFunction)) score = Math.min(score, jobFunction === 'Operations' ? 48 : 24);
  return { score: Math.max(0, Math.min(100, score)), functionName: jobFunction };
}

function targetIsFinanceRole(title: string): boolean {
  return financeFunctions.has(classifyJobFunction(title));
}

function getSeniorityCompatibility(candidate: CandidateProfile, job: Job): MatchResult['seniorityCompatibility'] {
  if (job.requiredExperience === null) return 'UNKNOWN';
  if (job.requiredExperience <= candidate.yearsOfExperience) return 'STRONG';
  if (job.requiredExperience <= candidate.yearsOfExperience + 2) return 'ACCEPTABLE';
  return 'LOW';
}

function calculateApplicabilityScore(candidate: CandidateProfile, job: Job, roleRelevanceScore: number): { score: number; seniority: MatchResult['seniorityCompatibility'] } {
  const indiaEligibility = candidate.preferredCountries.includes('India')
    ? job.indiaEligibilityStatus === 'YES' ? 100 : job.indiaEligibilityStatus === 'UNKNOWN' ? 45 : 0
    : 70;
  const remoteCompatibility = candidate.remoteOnly
    ? job.remoteStatus === 'FALSE' ? 0 : job.remoteStatus === 'TRUE' || job.remote ? 100 : 45
    : 70;
  const seniority = getSeniorityCompatibility(candidate, job);
  const seniorityScore = seniority === 'STRONG' ? 100 : seniority === 'ACCEPTABLE' ? 75 : seniority === 'UNKNOWN' ? 55 : 20;
  return {
    score: Math.round(roleRelevanceScore * 0.55 + indiaEligibility * 0.25 + remoteCompatibility * 0.1 + seniorityScore * 0.1),
    seniority,
  };
}

const getSkillMatches = (candidateSkills: string[], jobSkills: string[]) => {
  const candidateSet = new Set(candidateSkills.map(normalizeSkill));
  return jobSkills.filter((skill) => candidateSet.has(normalizeSkill(skill)));
};

export function getMatchTier(score: number): MatchTier {
  if (score >= 85) return 'Strong Match';
  if (score >= 70) return 'Good Match';
  if (score >= 55) return 'Potential Match';
  return 'Low Match';
}

export function calculateOpportunityScore(candidate: CandidateProfile, job: Job): number {
  let score = 0;

  if (job.indiaEligibilityStatus === 'YES') score += 27;
  else if (job.indiaEligibilityStatus === 'UNKNOWN') score += 14;

  if (job.remote) score += 18;
  else if (job.remoteStatus === 'UNKNOWN') score += 9;

  if (job.salaryMin !== null && job.salaryMin > 0) {
    const normalized = candidate.minimumSalary > 0 ? Math.min(candidate.minimumSalary / job.salaryMin, 1) : 0.5;
    score += Math.round(normalized * 15);
  } else {
    score += 8;
  }

  const freshnessDays = Math.max(0, (Date.now() - new Date(job.postedDate).getTime()) / 86400000);
  score += freshnessDays <= 30 ? 12 : freshnessDays <= 90 ? 8 : 5;

  if (job.requiredExperience === null) score += 6;
  else if (candidate.yearsOfExperience >= job.requiredExperience) score += 10;
  else score += 5;

  score += job.source.toLowerCase().includes('greenhouse') || job.source.toLowerCase().includes('lever') ? 8 : 5;

  return Math.min(100, Math.round(score));
}

export function calculateJobMatch(candidate: CandidateProfile, job: Job): MatchResult {
  const candidateSkills = candidate.keySkills.map(normalizeSkill);
  const jobSkills = job.requiredSkills.map(normalizeSkill);
  const matchedSkills = getSkillMatches(candidateSkills, jobSkills);
  const experienceWeight = 15;
  const skillWeight = 15;
  const locationWeight = 10;
  const salaryWeight = 10;
  const industryWeight = 5;
  const seniorityWeight = 5;
  const roleWeight = 40;
  const roleRelevance = calculateRoleRelevance(candidate, job);
  const applicability = calculateApplicabilityScore(candidate, job, roleRelevance.score);

  const experienceScore = job.requiredExperience === null
    ? experienceWeight * 0.5
    : Math.min(candidate.yearsOfExperience / Math.max(job.requiredExperience, 1), 1) * experienceWeight;

  const skillScore = (matchedSkills.length / Math.max(jobSkills.length, 1)) * skillWeight;

  const locationEligible =
    (job.indiaEligibilityStatus === 'YES' && candidate.preferredCountries.includes('India')) ||
    (job.remote && candidate.remoteOnly) ||
    (!candidate.remoteOnly && candidate.preferredCountries.includes(job.country));

  const locationScore = job.indiaEligibilityStatus === 'UNKNOWN' && candidate.preferredCountries.includes('India')
    ? locationWeight * 0.5
    : locationEligible ? locationWeight : 0;

  const salaryCandidate = candidate.minimumSalary;
  const salaryThreshold = job.salaryMin;
  const salaryScore = salaryThreshold === null || salaryThreshold === undefined
    ? salaryWeight * 0.5
    : Math.min(salaryCandidate / Math.max(salaryThreshold, 1), 1) * salaryWeight;

  const industryMatch = candidate.preferredIndustries.some((industry) =>
    job.industry.toLowerCase().includes(industry.toLowerCase()) || industry.toLowerCase().includes(job.industry.toLowerCase())
  );
  const industryScore = industryMatch ? industryWeight : industryWeight * 0.35;

  const seniorityMatch = job.requiredExperience === null || candidate.yearsOfExperience >= job.requiredExperience;
  const seniorityScore = seniorityMatch ? seniorityWeight : 0;

  const rawTotalScore = Math.min(100, Math.round(
    (applicability.score / 100 * roleWeight) +
      skillScore +
      experienceScore +
      locationScore +
      salaryScore +
      industryScore +
      seniorityScore
  ));
  const totalScore = targetIsFinanceRole(candidate.targetJobTitle) && roleRelevance.score < 30
    ? Math.min(45, rawTotalScore)
    : rawTotalScore;

  const reasons: string[] = [];
  if (job.requiredExperience === null || candidate.yearsOfExperience >= job.requiredExperience) {
    reasons.push(`${candidate.yearsOfExperience}+ years of relevant experience`);
  }
  if (matchedSkills.length > 0) {
    reasons.push(...matchedSkills.slice(0, 3).map((skill) => `Relevant skill: ${skill}`));
  }
  if (locationEligible || job.indiaEligibilityStatus === 'UNKNOWN') {
    reasons.push(job.remote ? 'Remote-friendly role' : `${job.country} location fits your preferences`);
  }
  if (salaryThreshold === null || salaryThreshold === undefined) {
    reasons.push('Salary not disclosed');
  } else if (salaryCandidate >= salaryThreshold) {
    reasons.push(`Salary target met: ${candidate.minimumSalary.toLocaleString()} ${candidate.preferredCurrency}`);
  }
  reasons.unshift(`Job function: ${roleRelevance.functionName} (${roleRelevance.score}/100)`);

  const missingRequirements: string[] = [];
  if (job.requiredExperience !== null && candidate.yearsOfExperience < job.requiredExperience) {
    missingRequirements.push(`${job.requiredExperience}+ years experience`);
  }
  if (matchedSkills.length < jobSkills.length) {
    const missingSkills = jobSkills.filter((skill) => !candidateSkills.includes(normalizeSkill(skill)));
    missingRequirements.push(...missingSkills.slice(0, 3).map((skill) => `${skill}`));
  }
  if (!locationEligible && job.indiaEligibilityStatus === 'NO') {
    missingRequirements.push(job.remote ? 'Remote-only preference' : `${job.country} location`);
  }
  if (salaryThreshold !== null && salaryCandidate < salaryThreshold && job.salaryMin !== null) {
    missingRequirements.push(`Salary minimum of ${job.salaryMin.toLocaleString()} ${job.salaryCurrency}`);
  }
  if (!industryMatch) {
    missingRequirements.push(`Industry: ${job.industry}`);
  }

  const visibleReasons = reasons.slice(0, 6);
  if ((salaryThreshold === null || salaryThreshold === undefined) && !visibleReasons.some((reason) => reason === 'Salary not disclosed')) {
    visibleReasons[visibleReasons.length - 1] = 'Salary not disclosed';
  }

  const opportunityScore = calculateOpportunityScore(candidate, job);

  return {
    job,
    score: totalScore,
    opportunityScore,
    roleRelevanceScore: roleRelevance.score,
    applicabilityScore: applicability.score,
    roleClassification: roleRelevance.functionName,
    seniorityCompatibility: applicability.seniority,
    matchTier: getMatchTier(totalScore),
    reasons: visibleReasons,
    missingRequirements: missingRequirements.slice(0, 5),
  };
}

export function sortMatches(profile: CandidateProfile, jobs: Job[]): MatchResult[] {
  return jobs
    .map((job) => calculateJobMatch(profile, job))
    .sort((a, b) => b.score - a.score || b.opportunityScore - a.opportunityScore);
}
