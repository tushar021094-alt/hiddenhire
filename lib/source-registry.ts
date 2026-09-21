export type SourceProvider = "greenhouse" | "ashby" | "lever" | "workable";

export type SourceDefinition = {
  provider: SourceProvider;
  identifier: string;
  company?: string;
  enabled?: boolean;
};

export const SOURCE_REGISTRY: SourceDefinition[] = [
  ...["coinbase","okta","samsara","twilio","stripe","doordash","hubspot","brex","rippling","cloudflare","cialfo","mpowerfinancing","6sense","berkadiaindia","zocdoc","narvar","gravitonresearchcapital"]
    .map(identifier => ({ provider: "greenhouse" as const, identifier })),
  ...["notion","ramp","deel","remote","vercel","linear","certa","riveron","HackerOne","reo-dev","almabase","Netspend-Careers-Page","glomo","livekit","TaptapSend","inato","finmid.com","numeral","brigit","unity-advisory","lumilens","pebl","certifyos","better-mortgage","cynlr",
      "junipersquare","handshake","plotlineso","lilt","savvymoney","redis"]
    .map(identifier => ({ provider: "ashby" as const, identifier })),
  ...["paytm","paytmpayments","Sprinto","saviynt","acceldata","fampay","dozee","hevodata","thinkahead"]
    .map(identifier => ({ provider: "lever" as const, identifier })),
  ...["sideinc","deepsource","development-group-inc","targetsmart-communications","tds-global-solutions","surgence","valsoft-corp","ai-acquisition","contineum-therapeutics","flatgigs","peterlucas"]
    .map(identifier => ({ provider: "workable" as const, identifier })),
];

export function parseConfiguredSources<T extends SourceDefinition>(provider: T["provider"], envValue?: string) {
  if (envValue == null) return SOURCE_REGISTRY.filter(source => source.provider === provider && source.enabled !== false);
  return envValue.split(",").map(identifier => identifier.trim()).filter(Boolean).map(identifier => ({
    provider,
    identifier,
  } as T));
}
