export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  source: string;
  url: string;
  posted: string;
  description: string;
  skills: string[];
  indiaEligible: boolean;
};

export type MatchResult = Job & {
  score: number;
  reasons: string[];
  gaps: string[];
};