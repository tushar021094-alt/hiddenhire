import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_CANDIDATE_PLUS_PLAN_ID;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  return { keyId, keySecret, planId, webhookSecret };
}

export function assertRazorpayCheckoutConfig() {
  const { keyId, keySecret, planId, webhookSecret } = getRazorpayConfig();
  if (!keyId || !keySecret || !planId || !webhookSecret) {
    throw new Error(
      "Razorpay checkout is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_CANDIDATE_PLUS_PLAN_ID and RAZORPAY_WEBHOOK_SECRET."
    );
  }
  return { keyId, keySecret, planId, webhookSecret };
}

export async function razorpayRequest<T>(
  path: string,
  init: RequestInit,
  keyId: string,
  keySecret: string
): Promise<T> {
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as T | { error?: { description?: string } } | null;
  if (!response.ok) {
    const description =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error?.description
        : undefined;
    throw new Error(description || `Razorpay API request failed with status ${response.status}.`);
  }

  return payload as T;
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature || "", "utf8");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function mapRazorpaySubscriptionStatus(event: string, status?: string | null) {
  // Only explicit successful lifecycle events may grant paid access.
  // subscription.authenticated is not proof that a subscription is active.
  if (event === "subscription.activated" || event === "subscription.resumed" || event === "subscription.charged") return "active";
  if (event === "subscription.cancelled" || status === "cancelled") return "cancelled";
  if (event === "subscription.completed" || event === "subscription.expired" || status === "completed" || status === "expired") return "expired";
  if (
    event === "subscription.halted" ||
    event === "subscription.paused" ||
    event === "subscription.pending" ||
    event === "subscription.authenticated" ||
    status === "halted" ||
    status === "paused" ||
    status === "pending" ||
    status === "authenticated" ||
    status === "past_due"
  ) return "past_due";
  // Fail closed: unknown events/statuses must never grant paid entitlements.
  return "past_due";
}
