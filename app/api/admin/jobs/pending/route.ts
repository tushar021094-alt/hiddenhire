import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Unable to verify admin access." },
      { status: 500 }
    );
  }

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      "id, title, description, job_function, city, region, country, remote, workplace_type, salary_min, salary_max, currency, experience_min, experience_max, status, created_at"
    )
    .eq("source_type", "native")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Unable to load moderation queue." },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobs: jobs ?? [] });
}