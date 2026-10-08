export type AppealStatus = "submitted" | "under_review" | "accepted" | "rejected";
export type AppealActor = "recruiter" | "admin";

export type ModerationAppeal = {
  id: string;
  caseId: string;
  jobId: string;
  recruiterId: string;
  reason: string;
  status: AppealStatus;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  resolution?: string | null;
};

export function validateAppealReason(reason: string) {
  const normalized = reason.trim();
  if (normalized.length < 20) return { valid: false, error: "Please provide at least 20 characters explaining why this restriction should be reviewed." };
  if (normalized.length > 2000) return { valid: false, error: "Appeal reason must be 2,000 characters or less." };
  return { valid: true, reason: normalized };
}

export function canSubmitAppeal(input: {
  caseStatus: "open" | "under_review" | "resolved" | "appealed";
  decision: "allow" | "warn" | "restrict" | "escalate";
  existingAppealStatus?: AppealStatus | null;
}) {
  if (!["restrict", "escalate"].includes(input.decision)) return false;
  if (!["open", "under_review", "appealed"].includes(input.caseStatus)) return false;
  return !input.existingAppealStatus || input.existingAppealStatus === "rejected";
}

export function resolveAppeal(status: "accepted" | "rejected", resolution: string) {
  return {
    status,
    resolution: resolution.trim().slice(0, 2000),
    caseStatus: status === "accepted" ? "resolved" as const : "open" as const,
    caseDecision: status === "accepted" ? "allow" as const : "restrict" as const,
  };
}
