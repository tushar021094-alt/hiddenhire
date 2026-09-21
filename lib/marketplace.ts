export type JobSourceType = "native"|"greenhouse"|"ashby"|"lever"|"other";
export type JobStatus = "draft"|"pending_review"|"published"|"paused"|"expired"|"rejected"|"closed";

export const NATIVE_JOB_DAYS = { free: 15, paid: 30 } as const;

export function jobValidityDays(planId:string) {
  return planId === "employer_free" ? NATIVE_JOB_DAYS.free : NATIVE_JOB_DAYS.paid;
}

export function canSearchCandidatePool(planId:string) {
  return planId !== "employer_free";
}

export function canBulkOutreach(planId:string) {
  return planId === "employer_starter" || planId === "employer_growth" || planId === "agency";
}

export function canAccessOwnApplicants() {
  return true;
}
