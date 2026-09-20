import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { matchJob, type Profile } from "@/lib/matcher";

export async function POST(request: Request) {
  try {
    const profile = (await request.json()) as Profile;
    const results = demoJobs
      .map((job) => matchJob(job, profile))
      .sort((a, b) => b.score - a.score);
    return NextResponse.json({ mode: "demo", results });
  } catch {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 });
  }
}