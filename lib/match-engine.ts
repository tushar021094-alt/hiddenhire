import type { CandidateProfile, Job, MatchResult } from './job-types';

const normalizeSkill = (value: string) => value.toLowerCase().trim();

const getSkillMatches = (candidateSkills: string[], jobSkills: string[]) => {
  const candidateSet = new Set(candidateSkills.map(normalizeSkill));
  return jobSkills.filter((skill) => candidateSet.has(normalizeSkill(skill)));
};

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

  const experienceScore = Math.min(candidate.yearsOfExperience / Math.max(job.requiredExperience, 1), 1) * experienceWeight;
  const skillScore = (matchedSkills.length / Math.max(jobSkills.length, 1)) * skillWeight;

  const locationEligible =
    (job.indiaEligible && candidate.preferredCountries.includes('India')) ||
    (job.remote && candidate.remoteOnly) ||
    (!candidate.remoteOnly && candidate.preferredCountries.includes(job.country));

  const locationScore = locationEligible ? locationWeight : 0;

  const salaryCandidate = candidate.minimumSalary;
  const salaryThreshold = job.salaryMin;
  const salaryScore = Math.min(salaryCandidate / Math.max(salaryThreshold, 1), 1) * salaryWeight;

  const industryMatch = candidate.preferredIndustries.some((industry) =>
    job.industry.toLowerCase().includes(industry.toLowerCase()) || industry.toLowerCase().includes(job.industry.toLowerCase())
  );
  const industryScore = industryMatch ? industryWeight : 0;

  const seniorityMatch = candidate.yearsOfExperience >= job.requiredExperience;
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
  if (candidate.yearsOfExperience >= job.requiredExperience) {
    reasons.push(`${candidate.yearsOfExperience}+ years of ${job.title.toLowerCase()} experience`);
  }
  if (matchedSkills.length > 0) {
    reasons.push(...matchedSkills.slice(0, 3).map((skill) => `Relevant skill: ${skill}`));
  }
  if (locationEligible) {
    reasons.push(job.remote ? 'Remote-friendly role' : `${job.country} location matches your preferences`);
  }
  if (salaryCandidate >= salaryThreshold) {
    reasons.push(`Salary target met: ${candidate.minimumSalary.toLocaleString()} ${candidate.preferredCurrency}`);
  }
  if (industryMatch) {
    reasons.push(`Industry fit: ${job.industry}`);
  }

  const missingRequirements: string[] = [];
  if (candidate.yearsOfExperience < job.requiredExperience) {
    missingRequirements.push(`${job.requiredExperience}+ years experience`);
  }
  if (matchedSkills.length < jobSkills.length) {
    const missingSkills = jobSkills.filter((skill) => !candidateSkills.includes(normalizeSkill(skill)));
    missingRequirements.push(...missingSkills.slice(0, 3).map((skill) => `${skill}`));
  }
  if (!locationEligible) {
    missingRequirements.push(job.remote ? 'Remote-only preference' : `${job.country} location`);
  }
  if (salaryCandidate < salaryThreshold) {
    missingRequirements.push(`Salary minimum of ${job.salaryMin.toLocaleString()} ${job.salaryCurrency}`);
  }
  if (!industryMatch) {
    missingRequirements.push(`Industry: ${job.industry}`);
  }

  return {
    job,
    score: totalScore,
    reasons: reasons.slice(0, 6),
    missingRequirements: missingRequirements.slice(0, 5),
  };
}

export function sortMatches(profile: CandidateProfile, jobs: Job[]): MatchResult[] {
  return jobs
    .map((job) => calculateJobMatch(profile, job))
    .sort((a, b) => b.score - a.score);
}
