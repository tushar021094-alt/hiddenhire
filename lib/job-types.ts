export type SalaryCurrency = 'USD' | 'INR' | 'EUR' | 'GBP';
export type EmploymentType = 'Full-time' | 'Contract' | 'Part-time';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  remote: boolean;
  indiaEligible: boolean;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: SalaryCurrency;
  employmentType: EmploymentType;
  industry: string;
  requiredSkills: string[];
  requiredExperience: number;
  description: string;
  applicationUrl: string;
  source: string;
  postedDate: string;
}

export interface CandidateProfile {
  resumeText: string;
  targetJobTitle: string;
  yearsOfExperience: number;
  minimumSalary: number;
  preferredCurrency: SalaryCurrency;
  preferredCountries: string[];
  remoteOnly: boolean;
  preferredIndustries: string[];
  keySkills: string[];
}

export interface MatchResult {
  job: Job;
  score: number;
  reasons: string[];
  missingRequirements: string[];
}
