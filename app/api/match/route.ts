import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/jobs";
import { matchJob, type Profile } from "@/lib/matcher";
import { discoverJobs } from "@/lib/sources";

function validProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<Profile>;
  return typeof profile.role === "string"
    && Array.isArray(profile.skills)
    && typeof profile.experience === "number"
    && typeof profile.location === "string"
    && typeof profile.remoteOnly === "boolean"
    && typeof profile.minSalary === "number";
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!validProfile(body)) {
      return NextResponse.json({ error: "Please provide a complete job profile." }, { status: 400 });
    }

    const liveJobs = await discoverJobs();
    const sourceJobs = liveJobs.length ? liveJobs : demoJobs;

    const eligibleJobs = sourceJobs.filter((job) => {
      if (profileLocation(body) === "india" && !job.indiaEligible) return false;
      if (body.remoteOnly && !job.remote) return false;
      return true;
    });

    const results = eligibleJobs
      .map((job) => matchJob(job, body))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    return NextResponse.json({
      mode: liveJobs.length ? "live" : "demo",
      sourceCount: sourceJobs.length,
      eligibleCount: eligibleJobs.length,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Job discovery failed. Please try again." }, { status: 500 });
  }
}

function profileLocation(profile: Profile) {
  return profile.location.trim().toLowerCase();
}
