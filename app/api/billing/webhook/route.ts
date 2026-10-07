import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRazorpayConfig,
  mapRazorpaySubscriptionStatus,
  verifyRazorpayWebhookSignature,
} from "@/lib/billing/razorpay";

type RazorpaySubscriptionEntity = {
  id: string;
  plan_id?: string | null;
  status?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string> | null;
};

type RazorpayWebhook = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
  };
};

function unixToIso(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const { webhookSecret, planId } = getRazorpayConfig();
  const signature = request.headers.get("x-razorpay-signature");

  if (!webhookSecret || !planId || !signature) {
    return NextResponse.json({ error: "Webhook configuration is incomplete." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: RazorpayWebhook;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const subscription = body.payload?.subscription?.entity;
  const event = body.event || "";

  if (!subscription?.id || subscription.plan_id !== planId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const profileId = subscription.notes?.profile_id;
  if (!profileId || !/^[0-9a-f-]{36}$/i.test(profileId)) {
    return NextResponse.json({ error: "Subscription is missing a valid profile_id note." }, { status: 422 });
  }

  const status = mapRazorpaySubscriptionStatus(event, subscription.status);
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: existingByProvider } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", "razorpay")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  const values = {
    profile_id: profileId,
    plan_id: "candidate_plus",
    status,
    provider: "razorpay",
    provider_subscription_id: subscription.id,
    current_period_start: unixToIso(subscription.current_start),
    current_period_end: unixToIso(subscription.current_end),
    cancel_at_period_end: status === "cancelled",
    updated_at: new Date().toISOString(),
  };

  if (existingByProvider?.id) {
    const { error } = await admin
      .from("subscriptions")
      .update(values)
      .eq("id", existingByProvider.id);

    if (error) {
      return NextResponse.json({ error: "Unable to persist subscription state." }, { status: 500 });
    }
  } else {
    const { data: pending } = await admin
      .from("subscriptions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("plan_id", "candidate_plus")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.id) {
      const { error } = await admin
        .from("subscriptions")
        .update(values)
        .eq("id", pending.id);
      if (error) {
        return NextResponse.json({ error: "Unable to persist subscription state." }, { status: 500 });
      }
    } else {
      const { error } = await admin.from("subscriptions").insert(values);
      if (error) {
        return NextResponse.json({ error: "Unable to persist subscription state." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
