import type { CandidateProfile, Job } from "./job-types";
import { isLocationMatch, normalizeLocation } from "./location-utils";
import {
  classifyJobFunction,
  isFinanceRoleRelevant,
  type JobFunction,
} from "./match-engine";

type CandidateSearchInput = Partial<CandidateProfile> & {
  targetRoles?: string[];
  preferredLocations?: string[];
  country?: string;
};

export interface CandidateSearchIntent {
  targetRoles: string[];
  allowedFunctions: JobFunction[];
  preferredLocations: string[];
  preferredCountries: string[];
  remoteOnly: boolean;
  minimumSalary: number;
  preferredCurrency: CandidateProfile["preferredCurrency"];
  yearsOfExperience: number;
}

const FINANCE_FUNCTIONS = new Set<JobFunction>([
  "Finance",
  "Accounting",
  "FP&A",
  "Audit",
  "Tax",
  "Treasury",
  "Risk",
]);

// ATS providers sometimes mark billing, invoice-processing or MIS jobs as
// generic Operations/Other. Preserve these finance-adjacent roles for finance
// candidates, but only from a specific title signal and never through Sales.
function isFinanceAdjacentTitle(title: string): boolean {
  return /\b(?:finance|financial|accounting|accountant|accounts executive|accounting executive|accounts payable|accounts receivable|billing(?: executive| analyst| specialist| officer| coordinator| manager)?|invoice processing|invoicing|mis(?: executive| analyst| reporting| specialist| manager)?|sap\s*(?:fi|fico|billing)|record to report|r2r|order to cash|o2c|p2p|general ledger|reconciliation|management accountant|finance operations|financial operations|payroll accountant|cost accountant|treasury|auditor|tax analyst|fp\s*&?\s*a|financial controller|controllership)\b/i.test(title);
}

function roleToFunctions(role: string): JobFunction[] {
  const normalized = role.toLowerCase().trim();

  if (
    /accounts payable|account payable|ap manager|p2p|procure to pay|accounting|accountant|accounts manager/i.test(
      normalized,
    )
  ) {
    return ["Accounting"];
  }

  if (/fp&a|financial planning/i.test(normalized)) {
    return ["FP&A"];
  }

  if (/audit|auditor/i.test(normalized)) {
    return ["Audit"];
  }

  if (/tax|gst|vat/i.test(normalized)) {
    return ["Tax"];
  }

  if (/treasury|cash management/i.test(normalized)) {
    return ["Treasury"];
  }

  if (/risk|underwriting/i.test(normalized)) {
    return ["Risk"];
  }

  if (/finance|financial|controller|controllership/i.test(normalized)) {
    return ["Finance"];
  }

  return [classifyJobFunction(role)];
}

function functionsForTargets(targetRoles: string[]): JobFunction[] {
  const functions = new Set<JobFunction>();

  for (const role of targetRoles) {
    for (const jobFunction of roleToFunctions(role)) {
      functions.add(jobFunction);
    }
  }

  return Array.from(functions);
}

function areFunctionsCompatible(
  targetFunction: JobFunction,
  jobFunction: JobFunction,
): boolean {
  if (targetFunction === jobFunction) {
    return true;
  }

  if (
    FINANCE_FUNCTIONS.has(targetFunction) &&
    FINANCE_FUNCTIONS.has(jobFunction)
  ) {
    return true;
  }

  if (
    (targetFunction === "Engineering" && jobFunction === "Software") ||
    (targetFunction === "Software" && jobFunction === "Engineering")
  ) {
    return true;
  }

  return false;
}

function normalizeCountryPreference(value: string): string {
  const normalized = normalizeLocation(value)
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();

  if (/^(?:in|india|republic of india)$/.test(normalized)) return "india";
  if (/^(?:us|usa|united states|united states of america)$/.test(normalized)) return "united states";
  if (/^(?:uk|gb|great britain|united kingdom|england|scotland|wales)$/.test(normalized)) return "united kingdom";
  if (/^(?:uae|united arab emirates)$/.test(normalized)) return "united arab emirates";
  if (/^(?:ca|canada)$/.test(normalized)) return "canada";
  if (/^(?:au|australia)$/.test(normalized)) return "australia";
  if (/^(?:sg|singapore)$/.test(normalized)) return "singapore";
  if (/^(?:de|germany)$/.test(normalized)) return "germany";
  if (/^(?:fr|france)$/.test(normalized)) return "france";
  if (/^(?:nl|netherlands)$/.test(normalized)) return "netherlands";
  if (/^(?:ie|ireland)$/.test(normalized)) return "ireland";
  return normalized;
}

function isCountryLevelLocation(value: string): boolean {
  const normalized = normalizeCountryPreference(value);
  return new Set([
    "india", "united states", "united kingdom", "united arab emirates",
    "canada", "australia", "singapore", "germany", "france",
    "netherlands", "ireland",
  ]).has(normalized);
}

function isLocationCompatible(
  intent: CandidateSearchIntent,
  job: Job,
): boolean {
  if (intent.remoteOnly) {
    return job.remote;
  }

  if (job.remote) {
    return true;
  }

  // A country accidentally stored in preferred_locations (older profiles used
  // [country] for this field) is not a city filter. For those profiles, enforce
  // the country preference against job.country instead of comparing "India"
  // with a city such as Noida or Gurugram.
  const specificLocations = intent.preferredLocations.filter(
    (value) => !isCountryLevelLocation(value),
  );

  if (specificLocations.length > 0) {
    return specificLocations.some((preferredLocation) =>
      isLocationMatch(preferredLocation, job.location),
    );
  }

  if (intent.preferredCountries.length === 0) {
    return true;
  }

  const jobCountry = normalizeCountryPreference(job.country);
  return intent.preferredCountries.some(
    (preferredCountry) => normalizeCountryPreference(preferredCountry) === jobCountry,
  );
}

function isSalaryCompatible(
  intent: CandidateSearchIntent,
  job: Job,
): boolean {
  if (
    job.salaryMin === null &&
    job.salaryMax === null
  ) {
    return true;
  }

  if (intent.minimumSalary <= 0) {
    return true;
  }

  // Never compare nominal salary amounts across currencies (for example,
  // 70,000 USD vs. 1,200,000 INR). Until market FX conversion is available,
  // keep cross-currency jobs eligible and let the match score treat salary as unknown.
  if (job.salaryCurrency && job.salaryCurrency !== intent.preferredCurrency) {
    return true;
  }

  if (job.salaryMax !== null) {
    return job.salaryMax >= intent.minimumSalary;
  }

  if (job.salaryMin !== null) {
    return job.salaryMin >= intent.minimumSalary;
  }

  return true;
}

function isExperienceCompatible(
  intent: CandidateSearchIntent,
  job: Job,
): boolean {
  if (job.requiredExperience === null) {
    return true;
  }

  if (intent.yearsOfExperience <= 0) {
    return true;
  }

  return job.requiredExperience <= intent.yearsOfExperience + 2;
}

export function buildCandidateSearchIntent(
  input: CandidateSearchInput,
): CandidateSearchIntent {
  const targetRoles = Array.from(
    new Set(
      (input.targetRoles ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  const fallbackRole = input.targetJobTitle?.trim() || "";

  if (
    fallbackRole &&
    !targetRoles.some(
      (role) => role.toLowerCase() === fallbackRole.toLowerCase(),
    )
  ) {
    targetRoles.unshift(fallbackRole);
  }

  const allowedFunctions = functionsForTargets(targetRoles);

  return {
    targetRoles,
    allowedFunctions,
    preferredLocations: Array.from(
      new Set(
        (input.preferredLocations ?? [])
          .filter((value): value is string => typeof value === "string")
          .map(normalizeLocation)
          .filter(Boolean),
      ),
    ),
    preferredCountries: Array.from(
      new Set(
        (input.preferredCountries ?? [input.country ?? "India"])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
    remoteOnly: Boolean(input.remoteOnly),
    minimumSalary:
      typeof input.minimumSalary === "number"
        ? input.minimumSalary
        : 0,
    preferredCurrency: input.preferredCurrency || "INR",
    yearsOfExperience:
      typeof input.yearsOfExperience === "number"
        ? input.yearsOfExperience
        : 0,
  };
}

export function isJobEligible(
  intent: CandidateSearchIntent,
  job: Job,
): boolean {
  if (
    job.indiaEligibilityStatus === "NO" ||
    job.indiaEligible === false
  ) {
    return false;
  }

  if (!isLocationCompatible(intent, job)) {
    return false;
  }

  if (!isSalaryCompatible(intent, job)) {
    return false;
  }

  if (!isExperienceCompatible(intent, job)) {
    return false;
  }

  if (intent.allowedFunctions.length === 0) {
    return false;
  }

  const functionMatches = intent.allowedFunctions.some(
    (targetFunction) => {
      const actualFunction = job.jobFunction
        ? (job.jobFunction as JobFunction)
        : classifyJobFunction(
            job.title,
            job.description,
          );

      if (
        targetFunction === "Finance" ||
        FINANCE_FUNCTIONS.has(targetFunction)
      ) {
        if (
          job.jobFunction &&
          !FINANCE_FUNCTIONS.has(actualFunction)
        ) {
          const genericExternalClassification =
            actualFunction === "Other" || actualFunction === "Operations";
          if (
            genericExternalClassification &&
            isFinanceAdjacentTitle(job.title)
          ) {
            return true;
          }
          return false;
        }

        if (!job.jobFunction) {
          const genericExternalClassification =
            actualFunction === "Other" || actualFunction === "Operations";
          if (
            genericExternalClassification &&
            isFinanceAdjacentTitle(job.title)
          ) {
            return true;
          }
          return isFinanceRoleRelevant(
            {
              targetJobTitle:
                intent.targetRoles.find(
                  (role) =>
                    roleToFunctions(role).includes(
                      targetFunction,
                    ),
                ) || targetFunction,
              yearsOfExperience: intent.yearsOfExperience,
              minimumSalary: intent.minimumSalary,
              preferredCurrency: intent.preferredCurrency,
              preferredCountries: intent.preferredCountries,
              remoteOnly: intent.remoteOnly,
              preferredIndustries: [],
              keySkills: [],
              resumeText: "",
            },
            job,
          );
        }
      }

      return areFunctionsCompatible(
        targetFunction,
        actualFunction,
      );
    },
  );

  return functionMatches;
}