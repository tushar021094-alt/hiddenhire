export type RelationshipStatus = "cold" | "active" | "interview_stage" | "reconnect";

export type CareerRelationshipInput = {
  recruiterId?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  recruiterResponseCount?: number | null;
};

export type CareerRelationship = {
  key: string;
  recruiterId: string | null;
  companyId: string | null;
  companyName: string;
  interactionCount: number;
  strengthScore: number;
  status: RelationshipStatus;
  lastInteractionAt: string;
  nextAction: "follow_up" | "prepare" | "reconnect" | "watch";
  nextActionDueAt: string | null;
  reasons: string[];
};

const statusWeight: Record<string, number> = {
  applied: 45,
  reviewing: 60,
  shortlisted: 75,
  interview: 90,
  hired: 100,
  rejected: 20,
  withdrawn: 10,
};

function daysSince(date: string, now: number) {
  return Math.max(0, (now - new Date(date).getTime()) / 86400000);
}

export function buildCareerRelationships(
  applications: CareerRelationshipInput[],
  now = Date.now(),
): CareerRelationship[] {
  const groups = new Map<string, CareerRelationshipInput[]>();

  for (const application of applications) {
    const key = application.recruiterId
      ? `recruiter:${application.recruiterId}`
      : application.companyId
        ? `company:${application.companyId}`
        : `company-name:${(application.companyName ?? "unknown").trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), application]);
  }

  return [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
    );
    const latest = sorted[0];
    const base = statusWeight[latest.status] ?? 30;
    const responseBonus = Math.min(10, Number(latest.recruiterResponseCount ?? 0) * 2);
    const recencyFactor = Math.max(0.65, 1 - daysSince(latest.updatedAt ?? latest.createdAt, now) / 180);
    const strengthScore = Math.round(Math.min(100, (base + responseBonus) * recencyFactor));

    const status: RelationshipStatus =
      latest.status === "interview" || latest.status === "hired"
        ? "interview_stage"
        : ["applied", "reviewing", "shortlisted"].includes(latest.status)
          ? "active"
          : latest.status === "rejected" || latest.status === "withdrawn"
            ? "reconnect"
            : "cold";

    const nextAction =
      status === "interview_stage"
        ? "prepare"
        : status === "active"
          ? daysSince(latest.updatedAt ?? latest.createdAt, now) >= 5 ? "follow_up" : "watch"
          : status === "reconnect"
            ? "reconnect"
            : "watch";

    const due = nextAction === "follow_up"
      ? new Date(new Date(latest.updatedAt ?? latest.createdAt).getTime() + 5 * 86400000).toISOString()
      : null;

    const reasons = [
      `${items.length} application${items.length === 1 ? "" : "s"} with this ${latest.recruiterId ? "recruiter" : "company"}.`,
      latest.status === "interview" || latest.status === "hired"
        ? "Relationship is at an interview-stage signal."
        : latest.status === "rejected"
          ? "A previous application creates a basis for future re-engagement."
          : latest.status === "shortlisted"
            ? "Recruiter interest is stronger than a standard application signal."
            : "Relationship is primarily based on application activity.",
    ];

    return {
      key,
      recruiterId: latest.recruiterId ?? null,
      companyId: latest.companyId ?? null,
      companyName: latest.companyName?.trim() || "Unknown company",
      interactionCount: items.length,
      strengthScore,
      status,
      lastInteractionAt: latest.updatedAt ?? latest.createdAt,
      nextAction,
      nextActionDueAt: due,
      reasons: [...new Set(reasons)],
    };
  }).sort((a, b) => b.strengthScore - a.strengthScore || b.interactionCount - a.interactionCount);
}
