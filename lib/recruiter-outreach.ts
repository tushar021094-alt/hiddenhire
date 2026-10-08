import type { RecruiterCandidateIntelligence } from "@/lib/recruiter-intelligence";

export type RecruiterOutreachPackage = {
  subject: string;
  message: string;
  personalizationPoints: string[];
  approvalRequired: true;
};

export function buildRecruiterOutreachPackage(input: {
  candidateName?: string | null;
  jobTitle: string;
  companyName?: string | null;
  intelligence: RecruiterCandidateIntelligence;
  candidateSkills?: string[] | null;
}): RecruiterOutreachPackage {
  const name = input.candidateName?.trim() || "there";
  const company = input.companyName?.trim() || "our team";
  const skills = (input.candidateSkills ?? []).filter(Boolean).slice(0, 2);
  const points = [
    input.intelligence.priority === "strong" ? "strong role fit" : "relevant role alignment",
    ...(skills.length ? [`skills including ${skills.join(" and ")}`] : []),
  ];
  return {
    subject: `Opportunity: ${input.jobTitle}`,
    message: `Hi ${name},\\n\\nI’m reaching out about the ${input.jobTitle} opportunity at ${company}. Your profile shows ${points.join(" and ")}, so I thought the role could be worth a conversation.\\n\\nIf you’re open to it, I’d be happy to share the role details and next steps.\\n\\nBest,\\nRecruiting Team`,
    personalizationPoints: points,
    approvalRequired: true,
  };
}
