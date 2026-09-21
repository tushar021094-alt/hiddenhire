export type Job = {
  id:string; title:string; company:string; location:string; city?:string; region?:string; country?:string;
  remote:boolean; workplaceType?:"Remote"|"Hybrid"|"On-site"|"Unknown";
  salaryMin?:number; salaryMax?:number; currency?:string; salaryUsdMin?:number; salaryUsdMax?:number;
  source:string; url:string; posted:string; description:string; skills:string[]; indiaEligible:boolean;
};
export type SearchFilters = {
  role:string; skills:string[]; experience:number; candidateCountry:string; market:"india"|"worldwide"; remoteOnly:boolean;
  workplace:"any"|"remote"|"hybrid"|"onsite"; minCtc:number; maxCtc?:number; ctcCurrency:string;
  jobCountry?:string; states:string[]; cities:string[];
};
export type MatchResult = Job & {score:number; reasons:string[]; gaps:string[];};