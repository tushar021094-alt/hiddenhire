export type RecruiterSlaApplication = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  candidateReminderCount?: number | null;
  lastCandidateReminderAt?: string | null;
  responseDueAt?: string | null;
  recruiterFirstResponseAt?: string | null;
  recruiterResponseCount?: number | null;
};

export type RecruiterSlaMetrics = {
  totalApplications: number;
  activeApplications: number;
  respondedApplications: number;
  responseRate: number;
  overdueApplications: number;
  remindedApplications: number;
  medianFirstResponseHours: number | null;
  averageFirstResponseHours: number | null;
  responsivenessScore: number;
  health: "excellent" | "good" | "needs_attention" | "insufficient_data";
};

const TERMINAL = new Set(["rejected", "withdrawn", "hired"]);
const ACTIVE = new Set(["applied", "reviewing", "shortlisted", "interview"]);

function hoursBetween(start: string, end: string) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 36e5);
}

export function calculateRecruiterSla(applications: RecruiterSlaApplication[], now = new Date()): RecruiterSlaMetrics {
  const totalApplications = applications.length;
  const responded = applications.filter((a) => Boolean(a.recruiterFirstResponseAt));
  const activeApplications = applications.filter((a) => ACTIVE.has(a.status)).length;
  const overdueApplications = applications.filter((a) => {
    if (TERMINAL.has(a.status) || !a.responseDueAt) return false;
    return new Date(a.responseDueAt).getTime() < now.getTime();
  }).length;
  const remindedApplications = applications.filter((a) => Number(a.candidateReminderCount || 0) > 0).length;
  const responseTimes = responded.map((a) => hoursBetween(a.createdAt, a.recruiterFirstResponseAt!)).sort((a,b) => a-b);
  const average = responseTimes.length ? responseTimes.reduce((a,b)=>a+b,0) / responseTimes.length : null;
  const median = responseTimes.length
    ? responseTimes.length % 2
      ? responseTimes[Math.floor(responseTimes.length/2)]
      : (responseTimes[responseTimes.length/2-1] + responseTimes[responseTimes.length/2]) / 2
    : null;

  const responseRate = totalApplications ? Math.round(responded.length / totalApplications * 100) : 0;
  const speedScore = median == null ? 50 : median <= 24 ? 100 : median <= 72 ? 85 : median <= 120 ? 70 : median <= 168 ? 55 : 35;
  const responseScore = totalApplications ? responseRate : 50;
  const overduePenalty = totalApplications ? Math.min(25, overdueApplications / totalApplications * 100) : 0;
  const reminderPenalty = totalApplications ? Math.min(20, remindedApplications / totalApplications * 60) : 0;
  const responsivenessScore = totalApplications
    ? Math.max(0, Math.min(100, Math.round(responseScore * 0.55 + speedScore * 0.45 - overduePenalty * 0.35 - reminderPenalty * 0.15)))
    : 0;

  const health =
    totalApplications < 5 ? "insufficient_data"
    : responsivenessScore >= 85 ? "excellent"
    : responsivenessScore >= 70 ? "good"
    : "needs_attention";

  return {
    totalApplications,
    activeApplications,
    respondedApplications: responded.length,
    responseRate,
    overdueApplications,
    remindedApplications,
    medianFirstResponseHours: median == null ? null : Math.round(median * 10) / 10,
    averageFirstResponseHours: average == null ? null : Math.round(average * 10) / 10,
    responsivenessScore,
    health,
  };
}

export function recruiterSlaLabel(metrics: RecruiterSlaMetrics) {
  if (metrics.health === "insufficient_data") return "Building responsiveness history";
  if (metrics.health === "excellent") return "Highly responsive recruiter";
  if (metrics.health === "good") return "Responsive recruiter";
  return "Response times need attention";
}
