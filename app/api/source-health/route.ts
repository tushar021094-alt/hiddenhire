import { NextResponse } from "next/server";
import { checkRegisteredSources } from "@/lib/source-health";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.SOURCE_HEALTH_TOKEN;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await checkRegisteredSources();
  const summary = {
    total: sources.length,
    healthy: sources.filter(source => source.status === "healthy").length,
    empty: sources.filter(source => source.status === "empty").length,
    failing: sources.filter(source => source.status === "failing").length,
    jobs: sources.reduce((sum, source) => sum + source.jobCount, 0),
  };

  return NextResponse.json({ checkedAt: new Date().toISOString(), summary, sources });
}
