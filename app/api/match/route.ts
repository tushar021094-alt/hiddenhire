import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { matchJob, type Profile } from "@/lib/matcher";
import { discoverJobs } from "@/lib/sources";

export async function POST(request: Request) {
  try {
    const profile = (await request.json()) as Profile;
    const liveJobs = await discoverJobs();
    const sourceJobs = liveJobs.length ? liveJobs : demoJobs;
    const results = sourceJobs.map((job) => matchJob(job, profile))
      .filter((job) => !profile.remoteOnly || job.remote)
      .sort((a, b) => b.score - a.score).slice(0, 50);
    return NextResponse.json({ mode: liveJobs.length ? "live" : "demo", sourceCount: sourceJobs.length, results });
  } catch {
    return NextResponse.json({ error: "Job discovery failed" }, { status: 500 });
  }
}
