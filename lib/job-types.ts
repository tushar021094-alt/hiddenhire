export type SalaryCurrency = 'USD' | 'INR' | 'EUR' | 'GBP';
export type EmploymentType = 'Full-time' | 'Contract' | 'Part-time';
export type IndiaEligibilityStatus = 'YES' | 'NO' | 'UNKNOWN';
export type RemoteStatus = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type MatchTier = 'Strong Match' | 'Good Match' | 'Potential Match' | 'Low Match';
export type FinanceSubfunction =
  | 'CORE_FINANCE' | 'FP&A' | 'ACCOUNTING' | 'CONTROLLERSHIP' | 'FINANCE_BUSINESS_PARTNER'
  | 'STRATEGIC_FINANCE' | 'TREASURY' | 'AUDIT' | 'TAX' | 'RISK' | 'COMPLIANCE'
  | 'SOX_IT_CONTROLS' | 'OTHER_FINANCE' | 'NOT_FINANCE';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  remote: boolean;
  remoteStatus: RemoteStatus;
  indiaEligible: boolean;
  indiaEligibilityStatus: IndiaEligibilityStatus;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: SalaryCurrency | 'USD';
  employmentType: EmploymentType;
  industry: string;
  requiredSkills: string[];
  requiredExperience: number | null;
  description: string;
  applicationUrl: string;
  source: string;
  postedDate: string;
  companyWebsite?: string;
  careersUrl?: string;
  ats?: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'other';
  remotePolicy?: string;
  freshnessScore?: number;
  isDemo?: boolean;
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
  opportunityScore: number;
  roleRelevanceScore: number;
  applicabilityScore: number;
  roleClassification: string;
  financeSubfunction: FinanceSubfunction;
  financeSubfunctionScore: number;
  seniorityCompatibility: 'STRONG' | 'ACCEPTABLE' | 'UNKNOWN' | 'LOW';
  matchTier: MatchTier;
  reasons: string[];
  missingRequirements: string[];
}
