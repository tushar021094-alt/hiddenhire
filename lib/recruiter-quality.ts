export type RecruiterQuality = {
  recruiterId: string;
  totalApplications: number;
  responseRate: number;
  overdueApplications: number;
  remindedApplications: number;
  medianFirstResponseHours: number | null;
  responsivenessScore: number;
  trustTier: "new" | "trusted" | "established" | "building" | "needs_attention";
  repeatedNonResponse: boolean;
  identityVerified: boolean;
  companyVerified: boolean;
  trustScore: number;
};

export function recruiterQualityLabel(q: RecruiterQuality) {
  if (q.trustTier === "new") return "Building response history";
  if (q.trustTier === "trusted") return "Trusted recruiter";
  if (q.trustTier === "established") return "Established recruiter";
  if (q.trustTier === "building") return "Building recruiter trust history";
  return "Response history needs attention";
}

export function recruiterQualityTone(q: RecruiterQuality) {
  if (q.trustTier === "trusted" || q.trustTier === "established") return "positive";
  if (q.trustTier === "needs_attention") return "warning";
  return "neutral";
}
