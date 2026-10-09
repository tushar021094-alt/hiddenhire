import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

const MAX_ITEMS = 12;

async function ownedApplication(supabase: any, applicationId: string, userId: string) {
  return supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("candidate_id", userId)
    .maybeSingle();
}

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  const applicationId = new URL(request.url).searchParams.get("applicationId")?.trim() || "";
  if (!applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });

  const { data: application, error: applicationError } = await ownedApplication(supabase, applicationId, user.id);
  if (applicationError) return NextResponse.json({ error: "Unable to verify application ownership." }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("career_execution_checklist_progress")
    .select("completed_items,updated_at")
    .eq("profile_id", user.id)
    .eq("application_id", applicationId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to load checklist progress." }, { status: 500 });
  return NextResponse.json({ completedItems: data?.completed_items ?? [], updatedAt: data?.updated_at ?? null });
}

export async function PUT(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }
  const payload = body as { applicationId?: unknown; completedItems?: unknown };
  const applicationId = typeof payload.applicationId === "string" ? payload.applicationId.trim() : "";
  if (!applicationId) return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
  if (!Array.isArray(payload.completedItems) || payload.completedItems.length > MAX_ITEMS ||
      payload.completedItems.some((item) => typeof item !== "string" || item.length > 300)) {
    return NextResponse.json({ error: "completedItems must be a list of up to 12 checklist labels." }, { status: 400 });
  }
  const completedItems = [...new Set(payload.completedItems as string[])];

  const { data: application, error: applicationError } = await ownedApplication(supabase, applicationId, user.id);
  if (applicationError) return NextResponse.json({ error: "Unable to verify application ownership." }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const { data, error } = await supabase
    .from("career_execution_checklist_progress")
    .upsert({
      profile_id: user.id,
      application_id: applicationId,
      completed_items: completedItems,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_id,application_id" })
    .select("completed_items,updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Unable to save checklist progress." }, { status: 500 });
  return NextResponse.json({ completedItems: data.completed_items, updatedAt: data.updated_at });
}
