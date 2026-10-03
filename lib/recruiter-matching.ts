import type { CandidateProfile, Job, SalaryCurrency } from "./job-types";

type RecruiterCandidateRow = {
  candidate_id: string;
  full_name: string | null;
  skills: string[] | null;
  experience_years: number | null;
  location: string | null;
  country: string | null;
  remote_only: boolean | null;
  min_salary: number | null;
  salary_currency: string | null;
  headline: string | null;
  target_roles: string[] | null;
  preferred_locations: string[] | null;
};

type RecruiterJobRow = {
  id: string;
  title: string;
  description: string;
  city: string | null;
  region: string | null;
  country: string;
  remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  experience_min: number | null;
  experience_max: number | null;
  created_at: string;
};

const SUPPORTED_CURRENCIES: SalaryCurrency[] = [
  "USD",
  "INR",
  "EUR",
  "GBP",
];

function normalizeCurrency(value: string | null): SalaryCurrency {
  const currency = value?.toUpperCase();

  return SUPPORTED_CURRENCIES.includes(currency as SalaryCurrency)
    ? (currency as SalaryCurrency)
    : "INR";
}

export function toCandidateProfile(
  row: RecruiterCandidateRow
): CandidateProfile {
  const country = row.country?.trim() || "India";

  return {
    resumeText: "",
    targetJobTitle: row.target_roles?.[0] || row.headline || "",
    yearsOfExperience: Number(row.experience_years || 0),
    minimumSalary: Number(row.min_salary || 0),
    preferredCurrency: normalizeCurrency(row.salary_currency),
    preferredCountries: country ? [country] : ["India"],
    remoteOnly: Boolean(row.remote_only),
    preferredIndustries: [],
    keySkills: Array.isArray(row.skills) ? row.skills : [],
  };
}

export function toRecruiterJob(
  row: RecruiterJobRow,
  companyName: string,
  requiredSkills: string[]
): Job {
  const country = row.country?.trim() || "India";

  return {
    id: row.id,
    title: row.title,
    company: companyName,
    location: row.city || row.region || country,
    country,
    remote: Boolean(row.remote),
    remoteStatus: row.remote ? "TRUE" : "FALSE",
    indiaEligible: country.toLowerCase() === "india",
    indiaEligibilityStatus:
      country.toLowerCase() === "india" ? "YES" : "NO",
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryCurrency: normalizeCurrency(row.currency),
    employmentType: "Full-time",
    industry: "",
    requiredSkills,
    requiredExperience: row.experience_min,
    description: row.description,
    applicationUrl: "",
    source: "HiddenHire",
    postedDate: row.created_at,
  };
}

export type { RecruiterCandidateRow, RecruiterJobRow };