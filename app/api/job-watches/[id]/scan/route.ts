import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { scanJobWatch } from "@/lib/job-watch-scan";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: watch, error: watchError } = await supabase
    .from("job_watches")
    .select("*")
    .eq("id", id)
    .eq("candidate_id", user.id)
    .maybeSingle();

  if (watchError) return NextResponse.json({ error: "Unable to load job watch." }, { status: 500 });
  if (!watch) return NextResponse.json({ error: "Job watch not found." }, { status: 404 });
  if (!watch.enabled) return NextResponse.json({ error: "This job watch is disabled." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const matches =
    body && typeof body === "object" && Array.isArray((body as { matches?: unknown }).matches)
      ? (body as { matches: unknown[] }).matches
      : [];

  try {
    const result = await scanJobWatch(supabase, watch, matches);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[job-watch] scan failed", id, error);
    return NextResponse.json({ error: "Unable to complete job watch scan." }, { status: 500 });
  }
}
