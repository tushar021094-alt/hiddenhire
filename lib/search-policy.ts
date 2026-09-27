import type { CandidateProfile, Job } from "./job-types";
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

const LOCATION_ALIASES: Record<string, string> = {
  noida: "noida",
  "noida, uttar pradesh": "noida",
  "noida, up": "noida",

  delhi: "delhi",
  "new delhi": "delhi",
  "delhi, india": "delhi",

  gurugram: "gurugram",
  gurgaon: "gurugram",
  "gurugram, haryana": "gurugram",
  "gurgaon, haryana": "gurugram",

  bengaluru: "bengaluru",
  bangalore: "bengaluru",
  "bengaluru, india": "bengaluru",
  "bangalore, india": "bengaluru",
};

function normalizeLocation(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return LOCATION_ALIASES[normalized] || normalized;
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

  if (intent.preferredLocations.length === 0) {
    return true;
  }

  const jobLocation = normalizeLocation(job.location);

  return intent.preferredLocations.some((preferredLocation) => {
    const normalizedPreferred = normalizeLocation(preferredLocation);

    return (
      jobLocation === normalizedPreferred ||
      jobLocation.includes(normalizedPreferred) ||
      normalizedPreferred.includes(jobLocation)
    );
  });
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
          return false;
        }

        if (!job.jobFunction) {
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
              preferredCurrency: "INR",
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