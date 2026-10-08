export type RecruiterQuality = {
  recruiterId: string;
  totalApplications: number;
  responseRate: number;
  overdueApplications: number;
  remindedApplications: number;
  medianFirstResponseHours: number | null;
  responsivenessScore: number;
  trustTier: "new" | "highly_responsive" | "responsive" | "needs_attention";
  repeatedNonResponse: boolean;
};

export function recruiterQualityLabel(q: RecruiterQuality) {
  if (q.trustTier === "new") return "Building response history";
  if (q.trustTier === "highly_responsive") return "Highly responsive recruiter";
  if (q.trustTier === "responsive") return "Responsive recruiter";
  return "Response history needs attention";
}

export function recruiterQualityTone(q: RecruiterQuality) {
  if (q.trustTier === "highly_responsive" || q.trustTier === "responsive") return "positive";
  if (q.trustTier === "needs_attention") return "warning";
  return "neutral";
}
