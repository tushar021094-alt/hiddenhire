import test from "node:test";
import assert from "node:assert/strict";

import type { Job } from "../lib/job-types.ts";
import {
  buildCandidateSearchIntent,
  isJobEligible,
} from "../lib/search-policy.ts";

const candidate = {
  targetJobTitle: "Finance Manager",
  targetRoles: [
    "Account Payable manager",
    "Finance Manager",
    "Finance Analyst",
    "Senior Accountant",
    "Accounts Manager",
  ],
  preferredLocations: ["Noida", "Delhi", "Gurugram"],
  yearsOfExperience: 11,
  minimumSalary: 1_000_000,
  preferredCurrency: "INR",
  preferredCountries: ["India"],
  remoteOnly: false,
  preferredIndustries: [],
  keySkills: ["Financial analysis"],
  country: "India",
};

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-job",
    title: "Finance Manager",
    company: "Test Company",
    location: "Noida",
    country: "India",
    remote: false,
    remoteStatus: "FALSE",
    indiaEligible: true,
    indiaEligibilityStatus: "YES",
    salaryMin: 1_500_000,
    salaryMax: 2_500_000,
    salaryCurrency: "INR",
    employmentType: "Full-time",
    industry: "",
    requiredSkills: [],
    requiredExperience: 5,
    description: "Finance management role.",
    applicationUrl: "",
    source: "HiddenHire",
    postedDate: new Date().toISOString(),
    ...overrides,
  };
}

const intent = buildCandidateSearchIntent(candidate);

test("candidate intent derives Finance and Accounting functions from all target roles", () => {
  assert.ok(intent.targetRoles.length >= 5);
  assert.ok(intent.allowedFunctions.includes("Finance"));
  assert.ok(intent.allowedFunctions.includes("Accounting"));
});

test("candidate intent normalizes preferred locations", () => {
  assert.deepEqual(intent.preferredLocations, [
    "noida",
    "delhi",
    "gurugram",
  ]);
});

test("native Finance job passes the function gate", () => {
  assert.equal(
    isJobEligible(intent, job({
      jobFunction: "Finance",
    })),
    true,
  );
});

test("native Accounting job passes for a finance candidate", () => {
  assert.equal(
    isJobEligible(intent, job({
      title: "Accounts Payable Manager",
      jobFunction: "Accounting",
    })),
    true,
  );
});

test("native Engineering job fails for a finance candidate", () => {
  assert.equal(
    isJobEligible(intent, job({
      title: "Engineering Manager",
      jobFunction: "Engineering",
      remote: true,
      remoteStatus: "TRUE",
      location: "Remote - India",
    })),
    false,
  );
});

test("native Marketing job fails for a finance candidate", () => {
  assert.equal(
    isJobEligible(intent, job({
      title: "Digital Marketing Manager",
      jobFunction: "Marketing",
      remote: true,
      remoteStatus: "TRUE",
      location: "Remote - India",
    })),
    false,
  );
});

test("native HR job fails for a finance candidate", () => {
  assert.equal(
    isJobEligible(intent, job({
      title: "HR Manager",
      jobFunction: "HR",
      remote: true,
      remoteStatus: "TRUE",
      location: "Remote - India",
    })),
    false,
  );
});

test("external Finance Manager is classified through title/description fallback", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        source: "companyDiscovery",
        title: "Finance Manager",
        jobFunction: undefined,
      }),
    ),
    true,
  );
});

test("external Engineering Manager is rejected through classifier fallback", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        source: "companyDiscovery",
        title: "Engineering Manager",
        description: "Lead engineering teams and software delivery.",
        jobFunction: undefined,
        remote: true,
        remoteStatus: "TRUE",
        location: "Remote - India",
      }),
    ),
    false,
  );
});

test("preferred on-site location is required", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        title: "Finance Manager",
        jobFunction: "Finance",
        location: "Noida, Uttar Pradesh",
      }),
    ),
    true,
  );

  assert.equal(
    isJobEligible(
      intent,
      job({
        title: "Finance Manager",
        jobFunction: "Finance",
        location: "Bengaluru, India",
      }),
    ),
    false,
  );
});

test("remote jobs remain eligible when candidate is not remote-only", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        remote: true,
        remoteStatus: "TRUE",
        location: "Remote - India",
      }),
    ),
    true,
  );
});

test("remote-only candidate rejects on-site jobs", () => {
  const remoteIntent = buildCandidateSearchIntent({
    ...candidate,
    remoteOnly: true,
  });

  assert.equal(
    isJobEligible(
      remoteIntent,
      job({
        jobFunction: "Finance",
        remote: false,
        remoteStatus: "FALSE",
        location: "Noida",
      }),
    ),
    false,
  );

  assert.equal(
    isJobEligible(
      remoteIntent,
      job({
        jobFunction: "Finance",
        remote: true,
        remoteStatus: "TRUE",
        location: "Remote - India",
      }),
    ),
    true,
  );
});

test("salary compatibility uses range overlap", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        salaryMin: 900_000,
        salaryMax: 1_200_000,
      }),
    ),
    true,
  );

  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        salaryMin: 700_000,
        salaryMax: 900_000,
      }),
    ),
    false,
  );
});

test("unknown salary does not eliminate a job", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        salaryMin: null,
        salaryMax: null,
      }),
    ),
    true,
  );
});

test("experience compatibility allows reasonable overqualification", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        requiredExperience: 10,
      }),
    ),
    true,
  );

  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        requiredExperience: 14,
      }),
    ),
    false,
  );
});

test("India-ineligible jobs are rejected", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        jobFunction: "Finance",
        country: "United States",
        indiaEligible: false,
        indiaEligibilityStatus: "NO",
      }),
    ),
    false,
  );
});

test("native employer-selected function is authoritative", () => {
  assert.equal(
    isJobEligible(
      intent,
      job({
        title: "Engineering Manager",
        jobFunction: "Finance",
      }),
    ),
    true,
  );

  assert.equal(
    isJobEligible(
      intent,
      job({
        title: "Finance Manager",
        jobFunction: "Engineering",
      }),
    ),
    false,
  );
});

test("Delhi preference includes the wider Delhi NCR metro for on-site roles", () => {
  const delhiIntent = buildCandidateSearchIntent({
    ...candidate,
    preferredLocations: ["Delhi"],
  });

  for (const location of ["Noida, Uttar Pradesh", "Greater Noida, Uttar Pradesh", "Gurugram, Haryana", "Ghaziabad, Uttar Pradesh", "Faridabad, Haryana"]) {
    assert.equal(
      isJobEligible(delhiIntent, job({ location, remote: false, remoteStatus: "FALSE" })),
      true,
      location,
    );
  }

  assert.equal(
    isJobEligible(delhiIntent, job({ location: "Bengaluru, India", remote: false, remoteStatus: "FALSE" })),
    false,
  );
});
