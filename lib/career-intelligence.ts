import type { MatchResult } from "./job-types";

export type CareerIntelligenceInput = {
  targetRoles: string[];
  preferredLocations: string[];
  location: string | null;
  skills: string[];
  yearsOfExperience: number;
  minimumSalary: number;
  remoteOnly: boolean;
  matches: MatchResult[];
};

export type CareerIntelligence = {
  score: number;
  label: "Early Signal" | "Developing Signal" | "Strong Signal" | "Elite Signal";
  dimensions: {
    roleClarity: number;
    skillDepth: number;
    experienceStrength: number;
    marketFit: number;
    searchReadiness: number;
  };
  strongestSignals: string[];
  gaps: string[];
  priorityActions: string[];
  evidence: { jobsAnalyzed: number; strongMatches: number; averageMatch: number; topMatch: number };
};

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function clean(value: string) { return value.trim().toLowerCase(); }

export function buildCareerIntelligence(input: CareerIntelligenceInput): CareerIntelligence {
  const roles = input.targetRoles.map(clean).filter(Boolean);
  const skills = input.skills.map(clean).filter(Boolean);
  const locations = [...input.preferredLocations, input.location || ""].map(clean).filter(Boolean);
  const matches = [...input.matches].sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, 5);
  const averageMatch = matches.length ? Math.round(matches.reduce((sum, item) => sum + item.score, 0) / matches.length) : 0;
  const strongMatches = matches.filter((item) => item.score >= 75).length;
  const topMatch = matches[0]?.score ?? 0;

  const roleClarity = clamp(roles.length === 0 ? 0 : 55 + Math.min(25, roles.length * 10) + (roles[0].length >= 6 ? 20 : 10));
  const skillDepth = clamp(skills.length * 12 + (skills.length >= 5 ? 20 : 0));
  const experienceStrength = clamp(input.yearsOfExperience <= 0 ? 15 : 35 + Math.min(65, input.yearsOfExperience * 7));
  const marketFit = clamp(averageMatch * 0.7 + (matches.length ? (strongMatches / matches.length) * 30 : 0));
  const searchReadiness = clamp((locations.length ? 30 : 0) + (input.minimumSalary > 0 ? 25 : 0) + (input.remoteOnly ? 20 : 10) + (matches.length ? 25 : 0));

  const score = clamp(roleClarity * 0.18 + skillDepth * 0.18 + experienceStrength * 0.16 + marketFit * 0.38 + searchReadiness * 0.10);
  const label = score >= 85 ? "Elite Signal" : score >= 70 ? "Strong Signal" : score >= 50 ? "Developing Signal" : "Early Signal";

  const strongestSignals: string[] = [];
  const gaps: string[] = [];
  const priorityActions: string[] = [];

  if (topMatch >= 85) strongestSignals.push(`Top opportunity fit is ${topMatch}%, indicating a highly aligned role.`);
  if (strongMatches >= 3) strongestSignals.push(`${strongMatches} opportunities currently clear the strong-match threshold.`);
  if (skills.length >= 5) strongestSignals.push(`${skills.length} skills are contributing to your matching signal.`);
  if (input.yearsOfExperience >= 5) strongestSignals.push(`${input.yearsOfExperience}+ years of experience supports mid/senior-level targeting.`);
  if (input.remoteOnly && matches.length && matches.some((item) => item.job.remote)) strongestSignals.push("Your remote preference is finding compatible opportunities.");
  if (!strongestSignals.length) strongestSignals.push("HiddenHire is still collecting enough market evidence to identify your strongest signals.");

  if (!roles.length) { gaps.push("Add a target role so HiddenHire can rank opportunities around a clear career direction."); priorityActions.push("Define your primary target role."); }
  if (skills.length < 5) { gaps.push(`Only ${skills.length} skills are currently tracked; broader skill coverage will improve matching precision.`); priorityActions.push("Add the 3–5 skills most relevant to your target role."); }
  if (!input.minimumSalary) { gaps.push("No minimum compensation target is set, so salary-fit intelligence is limited."); priorityActions.push("Set a realistic minimum salary target."); }
  if (!locations.length) { gaps.push("No preferred location is set, reducing location-fit precision."); priorityActions.push("Add preferred cities, regions or countries."); }
  if (matches.length === 0) { gaps.push("No live market matches are available yet."); priorityActions.push("Run a fresh opportunity scan after completing your profile signal."); }
  else if (averageMatch < 65) { gaps.push(`Current market fit averages ${averageMatch}%; targeting or skill alignment needs refinement.`); priorityActions.push("Refine target roles or close the most common skill gaps in your top opportunities."); }

  const missing = new Map<string, number>();
  for (const match of topMatches) for (const requirement of match.missingRequirements) {
    const key = requirement.trim();
    if (key) missing.set(key, (missing.get(key) ?? 0) + 1);
  }
  for (const [gap, count] of [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
    if (count >= 2) gaps.push(`Repeated opportunity gap: ${gap}. It appears across ${count} top matches.`);
  }

  return {
    score, label,
    dimensions: { roleClarity, skillDepth, experienceStrength, marketFit, searchReadiness },
    strongestSignals: strongestSignals.slice(0, 4),
    gaps: [...new Set([...missing.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([gap, count]) => 'Repeated opportunity gap: ' + gap + '. It appears across ' + count + ' top matches.')), ...gaps].slice(0, 4),
    priorityActions: priorityActions.slice(0, 3),
    evidence: { jobsAnalyzed: matches.length, strongMatches, averageMatch, topMatch },
  };
}
