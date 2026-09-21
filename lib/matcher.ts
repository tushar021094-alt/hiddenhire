import type { Job, MatchResult, SearchFilters } from "./types";

const normalize = (value:string) => value.toLowerCase().replace(/[^a-z0-9+.#& ]/g," ").replace(/\s+/g," ").trim();
const tokens = (value:string) => normalize(value).split(" ").filter(t=>t.length>1 && !["profile","role","job","jobs","position","opening","openings"].includes(t));

const ROLE_ALIASES:Record<string,string[]> = {
  finance:["finance","financial"], accounting:["accounting","accountant","accounts"],
  ap:["accounts payable","payables","accounts payable specialist","accounts payable manager"],
  ar:["accounts receivable","receivables","accounts receivable specialist","accounts receivable manager"],
  "accounts payable":["accounts payable","payables"], "accounts receivable":["accounts receivable","receivables"],
  sales:["sales","business development","bd","account executive","account manager","territory sales","inside sales","field sales","key account"],
  "business development":["business development","bd","sales","account executive"],
  marketing:["marketing","growth marketing","digital marketing","brand marketing","product marketing"],
  hr:["human resources","hr","people","talent acquisition","recruitment","recruiting"],
  recruitment:["recruitment","recruiting","talent acquisition","sourcing"],
  it:["information technology","it","technology","tech"],
  software:["software","software engineering","software developer","developer","engineer"],
  engineering:["engineering","engineer"],
  product:["product management","product manager","product"],
  operations:["operations","business operations","operations management"],
  procurement:["procurement","purchasing","sourcing"],
  legal:["legal","law","counsel","compliance"],
  "customer success":["customer success","client success","customer experience"],
  "customer support":["customer support","customer service","support"],
  financeops:["finance operations","financial operations"],
  fp:["fp&a","fpa","financial planning","planning","forecasting"],
  fpa:["fp&a","fpa","financial planning","planning","forecasting"],
  "financial controller":["financial controller","controller","controllership"],
};

const SENIORITY:Record<string,string[]> = {
  manager:["manager","management"], senior:["senior","sr"], lead:["lead"], director:["director"], head:["head"], vp:["vp","vice president"],
  analyst:["analyst"], executive:["executive"], specialist:["specialist"], associate:["associate"], intern:["intern","trainee"]
};

const DEPARTMENTS:Record<string,string[]> = {
  finance:["finance","financial","accounting","accounts payable","payables","accounts receivable","receivables","fp&a","fpa","controller","controllership"],
  sales:["sales","business development","account executive","account manager","territory sales","inside sales","field sales","key account"],
  marketing:["marketing","growth","brand","digital marketing","product marketing"],
  hr:["human resources","hr","people","talent acquisition","recruitment","recruiting"],
  it:["information technology","it","technology","software","engineering","developer"],
  product:["product management","product manager","product"],
  operations:["operations","business operations"],
  procurement:["procurement","purchasing","sourcing"],
  legal:["legal","law","counsel","compliance"],
  customer:["customer success","customer support","customer service","client success"],
};

function containsTerm(haystack:string,term:string){
  const n=normalize(term); return !!n && (` ${haystack} `).includes(` ${n} `);
}
function aliasesFor(term:string){const n=normalize(term); return ROLE_ALIASES[n]??[n];}

function requestedDepartment(role:string){
  const text=normalize(role);
  for(const [department,aliases] of Object.entries(DEPARTMENTS)){
    if(aliases.some(a=>containsTerm(text,a))) return department;
  }
  return null;
}
function titleDepartment(title:string){
  const text=normalize(title);
  for(const [department,aliases] of Object.entries(DEPARTMENTS)){
    if(aliases.some(a=>containsTerm(text,a))) return department;
  }
  return null;
}

function requestedTitleMatches(role:string,title:string){
  const requested=tokens(role), titleText=normalize(title);
  if(!requested.length) return false;
  return requested.every(token=>{
    const aliases=aliasesFor(token);
    return aliases.some(alias=>containsTerm(titleText,alias));
  });
}

function roleMatch(role:string,title:string,description:string){
  const titleText=normalize(title), descriptionText=normalize(description);
  const department=requestedDepartment(role);
  const jobDepartment=titleDepartment(title);
  const departmentMatch=!department || jobDepartment===department;
  const titleMatch=requestedTitleMatches(role,title);
  const exactTitle=containsTerm(titleText,normalize(role));
  const roleAliases=aliasesFor(role);
  const phraseHits=roleAliases.some(alias=>containsTerm(titleText,alias));
  const titleHits=tokens(role).filter(token=>aliasesFor(token).some(alias=>containsTerm(titleText,alias)));
  const descriptionHits=tokens(role).filter(token=>!titleHits.includes(token)&&aliasesFor(token).some(alias=>containsTerm(descriptionText,alias)));
  return {department,jobDepartment,departmentMatch,titleMatch,exactTitle,phraseHits,titleHits,descriptionHits,total:Math.max(tokens(role).length,1)};
}

export function isRoleRelevant(job:Job,profile:SearchFilters){
  const role=roleMatch(profile.role,job.title,job.description);
  // Department is mandatory whenever the requested role maps to a known function.
  // For multi-word roles, every meaningful requested term must also be represented
  // in the title. This prevents "Finance Manager" from matching "Sales Manager".
  return role.departmentMatch && (role.titleMatch || role.phraseHits || role.exactTitle);
}

function skillMatch(skills:string[],job:Job){
  const haystack=normalize([job.title,job.description,...job.skills].join(" "));
  return skills.filter(skill=>{const n=normalize(skill);return !!n&&(containsTerm(haystack,n)||tokens(skill).some(t=>t.length>2&&containsTerm(haystack,t)));});
}

export function matchJob(job:Job,profile:SearchFilters):MatchResult{
  const role=roleMatch(profile.role,job.title,job.description),matchedSkills=skillMatch(profile.skills,job);
  const departmentScore=role.department?role.departmentMatch?10:0:5;
  const roleScore=Math.min(40,departmentScore+(role.titleMatch?30:role.phraseHits||role.exactTitle?24:role.titleHits.length/role.total*16)+(role.descriptionHits.length/role.total*4));
  const skillScore=profile.skills.length?Math.min(15,matchedSkills.length/profile.skills.length*15):0;
  const locationScore=profile.market==="india"?(job.indiaEligible?10:0):10;
  const salaryScore=job.salaryUsdMin?Math.min(10,Math.max(0,job.salaryUsdMin/Math.max(profile.minCtc,1)*10)):4;
  const seniorityScore=/director|head|vp|vice president/i.test(job.title)&&profile.experience<7?2:/manager|senior|lead|director|head/i.test(job.title)?5:3;
  const companyScore=job.country?5:2;
  const score=Math.round(Math.min(100,roleScore+skillScore+locationScore+salaryScore+seniorityScore+companyScore));
  const reasons=[
    role.department?role.departmentMatch?`${role.department} function match`:`Different department: ${role.jobDepartment??"unclassified"}`:(role.phraseHits||role.exactTitle?"Direct title/role match":role.titleHits.length?`Role terms in title: ${role.titleHits.length}/${role.total}`:"Limited direct role alignment"),
    role.titleMatch?"Requested title terms match":role.phraseHits||role.exactTitle?"Direct title/role match":"Limited title alignment",
    matchedSkills.length?`${matchedSkills.length} of your skills appear relevant`:"Few matching skills detected",
    job.remote?"Remote work detected":job.workplaceType==="Hybrid"?"Hybrid work detected":"On-site role",
    job.salaryMin?"Published compensation detected":"Salary not disclosed; verify compensation on the employer page",
  ];
  const gaps=[
    ...(job.salaryUsdMin&&job.salaryUsdMin<profile.minCtc?["Compensation below target"]:[]),
    ...(profile.market==="india"&&!job.indiaEligible?["India eligibility not confirmed"]:[]),
    ...(matchedSkills.length<Math.min(2,profile.skills.length)?["Skill overlap is limited"]:[]),
  ];
  return {...job,score,reasons,gaps};
}
