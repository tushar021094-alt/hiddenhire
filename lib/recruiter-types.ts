export type CandidateProfile = {
 id:string; fullName:string; currentTitle:string; headline:string; summary:string;
 skills:string[]; experienceYears:number; location:string; country:string;
 remoteOnly:boolean; minSalary:number; salaryCurrency:string; preferredLocations:string[];
 visibility:"public"|"match_only"|"private";
};
export type RecruiterJob = {
 title:string; description:string; company:string; city?:string; region?:string; country?:string;
 remote:boolean; salaryMin?:number; salaryMax?:number; currency?:string;
 experienceMin?:number; experienceMax?:number; skills:string[];
 normalizedRole?:string; normalizedSkills:string[];
};
export type CandidateMatch = CandidateProfile & {
 score:number; reasons:string[]; gaps:string[]; matchedSkills:string[];
};