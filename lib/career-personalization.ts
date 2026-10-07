import type { MatchResult } from "@/lib/job-types";
import { applyLearningPolicy } from "@/lib/career-learning-attribution";
import type { buildAttributionInsights } from "@/lib/career-learning-attribution";

type AttributionPolicy = ReturnType<typeof buildAttributionInsights>["policy"];
export type CareerPersonalization = { eligible:boolean; sampleSize:number; confidence:"low"|"medium"|"high"; headline:string; focus:string[] };

export function buildCareerPersonalization(policy:AttributionPolicy,strategyLearning:Array<{strategyId:string;sampleSize:number;adjustment:number}>=[]):CareerPersonalization {
  const sampleSize = policy.eligible ? Math.max(30, strategyLearning.reduce((sum,item)=>sum+item.sampleSize,0)) : 0;
  const positive = policy.boosts.slice(0,2).map(item=>item.group+" opportunities");
  const focus = [...positive,...strategyLearning.filter(item=>item.adjustment>0).slice(0,2).map(item=>item.strategyId+" strategy")];
  const confidence = policy.eligible && sampleSize>=100 ? "high" : policy.eligible ? "medium" : "low";
  return {eligible:policy.eligible,sampleSize,confidence,headline:policy.eligible ? (focus.length ? "Personalized from your outcome history: prioritize "+focus.slice(0,2).join(" and ")+ "." : "Personalized ranking is active from your outcome history.") : "Personalization is collecting outcome evidence before it changes opportunity ordering.",focus};
}

export function personalizeMatch(match:MatchResult,policy:AttributionPolicy) {
  const adjusted=applyLearningPolicy(match.score,{source:match.job.source,role:match.job.jobFunction||match.roleClassification,remote:match.job.remote,score:match.score},policy);
  const adjustment=adjusted-match.score;
  return {...match,learningAdjustment:adjustment,personalizedScore:adjusted};
}
