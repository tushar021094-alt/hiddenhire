import { NextResponse } from "next/server";
import { discoverAndIndex, refreshIndexedSources } from "@/lib/company-indexing";
export const runtime="nodejs"; export const maxDuration=60;
function authorized(r:Request){const t=r.headers.get("authorization")?.replace(/^Bearer\s+/i,"");return Boolean(t)&&[process.env.COMPANY_INDEXING_TOKEN,process.env.CRON_SECRET].filter(Boolean).includes(t);}
export async function POST(r:Request){if(!authorized(r))return NextResponse.json({error:"Unauthorized"},{status:401});try{const b=await r.json() as{url?:string};if(!b.url)return NextResponse.json({error:"A public company or careers URL is required."},{status:400});return NextResponse.json(await discoverAndIndex(b.url));}catch(e){console.error("[company-index] POST failed",e);return NextResponse.json({error:"Company indexing failed."},{status:500});}}
export async function GET(r:Request){if(!authorized(r))return NextResponse.json({error:"Unauthorized"},{status:401});try{return NextResponse.json(await refreshIndexedSources());}catch(e){console.error("[company-index] GET refresh failed",e);return NextResponse.json({error:"Source refresh failed."},{status:500});}}
