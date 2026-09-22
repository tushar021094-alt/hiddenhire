export type PlanId = "candidate_free"|"candidate_plus"|"employer_free"|"employer_starter"|"employer_growth"|"agency";

export type EntitlementKey =
  | "active_jobs"
  | "job_credits"
  | "ai_matches"
  | "candidate_contact_unlocks"
  | "recruiter_seats"
  | "featured_boosts"
  | "saved_jobs"
  | "ai_resume_optimizations"
  | "ai_cover_letters"
  | "ai_interview_sessions";

export type PlanDefinition = {
  id: PlanId;
  audience: "candidate"|"employer"|"agency";
  monthlyPriceInr: number;
  limits: Partial<Record<EntitlementKey, number>>;
};

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  candidate_free: { id:"candidate_free", audience:"candidate", monthlyPriceInr:0, limits:{saved_jobs:10,ai_resume_optimizations:1,ai_cover_letters:1,ai_interview_sessions:1} },
  candidate_plus: { id:"candidate_plus", audience:"candidate", monthlyPriceInr:199, limits:{saved_jobs:Infinity,ai_resume_optimizations:10,ai_cover_letters:10,ai_interview_sessions:10} },
  employer_free: { id:"employer_free", audience:"employer", monthlyPriceInr:0, limits:{active_jobs:1,job_credits:1,ai_matches:10,recruiter_seats:1,featured_boosts:0,candidate_contact_unlocks:0} },
  employer_starter: { id:"employer_starter", audience:"employer", monthlyPriceInr:1999, limits:{active_jobs:5,job_credits:5,ai_matches:100,recruiter_seats:1,featured_boosts:1,candidate_contact_unlocks:25} },
  employer_growth: { id:"employer_growth", audience:"employer", monthlyPriceInr:4999, limits:{active_jobs:10,job_credits:20,ai_matches:500,recruiter_seats:5,featured_boosts:5,candidate_contact_unlocks:150} },
  agency: { id:"agency", audience:"agency", monthlyPriceInr:7999, limits:{active_jobs:50,job_credits:50,ai_matches:1000,recruiter_seats:10,candidate_contact_unlocks:500,featured_boosts:10} },
};

export function planForAudience(audience:"candidate"|"employer"|"agency", planId?:PlanId): PlanDefinition {
  const fallback: Record<typeof audience, PlanId> = {candidate:"candidate_free",employer:"employer_free",agency:"agency"};
  const id = planId && PLAN_DEFINITIONS[planId]?.audience === audience ? planId : fallback[audience];
  return PLAN_DEFINITIONS[id];
}

export function canConsume(limit:number|undefined, used:number, amount=1) {
  if (limit === undefined || limit === Infinity) return true;
  return used + amount <= limit;
}
