import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { PLAN_DEFINITIONS, planForAudience, type PlanId } from "@/lib/entitlements";

export async function GET() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) return NextResponse.json({ error: authError || "Authentication is required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const audience = profile?.role === "agency" ? "agency" : profile?.role === "employer" ? "employer" : "candidate";

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_id,status,provider,current_period_start,current_period_end,cancel_at_period_end")
    .eq("profile_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planId = (subscription?.plan_id as PlanId | undefined);
  const plan = planForAudience(audience, planId);
  return NextResponse.json({
    audience,
    plan: plan.id,
    definition: PLAN_DEFINITIONS[plan.id],
    subscription: subscription ?? null,
    checkoutReady: false,
  });
}
