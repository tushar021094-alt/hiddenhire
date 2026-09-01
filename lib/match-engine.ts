import type { CandidateProfile, Job, MatchResult, MatchTier } from './job-types';

const normalizeSkill = (value: string) => value.toLowerCase().trim();

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
  const experienceWeight = 25;
  const skillWeight = 25;
  const locationWeight = 20;
  const salaryWeight = 15;
  const industryWeight = 10;
  const seniorityWeight = 5;

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

  const totalScore = Math.min(100, Math.round(
    experienceScore +
      skillScore +
      locationScore +
      salaryScore +
      industryScore +
      seniorityScore
  ));

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
  if (industryMatch) {
    reasons.push(`Industry fit: ${job.industry}`);
  }

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

  const opportunityScore = calculateOpportunityScore(candidate, job);

  return {
    job,
    score: totalScore,
    opportunityScore,
    matchTier: getMatchTier(totalScore),
    reasons: reasons.slice(0, 6),
    missingRequirements: missingRequirements.slice(0, 5),
  };
}

export function sortMatches(profile: CandidateProfile, jobs: Job[]): MatchResult[] {
  return jobs
    .map((job) => calculateJobMatch(profile, job))
    .sort((a, b) => b.score - a.score || b.opportunityScore - a.opportunityScore);
}
