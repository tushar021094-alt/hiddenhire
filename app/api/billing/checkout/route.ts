import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getActivePlanId } from "@/lib/entitlements";
import {
  assertRazorpayCheckoutConfig,
  razorpayRequest,
} from "@/lib/billing/razorpay";

type RazorpaySubscription = {
  id: string;
  status: string;
  plan_id: string;
  short_url?: string | null;
  current_start?: number | null;
  current_end?: number | null;
};

export async function POST() {
  const { supabase, user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: authError || "Authentication is required." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && profile.role !== "candidate") {
    return NextResponse.json(
      { error: "Candidate Plus checkout is only available to candidate accounts." },
      { status: 403 }
    );
  }

  const currentPlan = await getActivePlanId(supabase, user.id);
  if (currentPlan === "candidate_plus") {
    return NextResponse.json(
      { error: "Candidate Plus is already active." },
      { status: 409 }
    );
  }

  let config: ReturnType<typeof assertRazorpayCheckoutConfig>;
  try {
    config = assertRazorpayCheckoutConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Razorpay checkout is not configured." },
      { status: 503 }
    );
  }

  try {
    const subscription = await razorpayRequest<RazorpaySubscription>(
      "/subscriptions",
      {
        method: "POST",
        body: JSON.stringify({
          plan_id: config.planId,
          total_count: 1200,
          quantity: 1,
          customer_notify: true,
          notes: {
            profile_id: user.id,
            hiddenhire_plan: "candidate_plus",
          },
        }),
      },
      config.keyId,
      config.keySecret
    );

    if (!subscription.short_url) {
      return NextResponse.json(
        { error: "Razorpay created the subscription but did not return a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      provider: "razorpay",
      plan: "candidate_plus",
      subscriptionId: subscription.id,
      checkoutUrl: subscription.short_url,
      status: subscription.status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Razorpay subscription." },
      { status: 502 }
    );
  }
}
