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
  const { keyId, keySecret, planId } = getRazorpayConfig();
  if (!keyId || !keySecret || !planId) {
    throw new Error(
      "Razorpay checkout is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_CANDIDATE_PLUS_PLAN_ID."
    );
  }
  return { keyId, keySecret, planId };
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
  if (event === "subscription.activated" || event === "subscription.resumed") return "active";
  if (event === "subscription.cancelled") return "cancelled";
  if (event === "subscription.completed") return "completed";
  if (event === "subscription.expired") return "expired";
  if (event === "subscription.halted") return "halted";
  if (event === "subscription.paused") return "paused";
  if (event === "subscription.charged") return "active";
  if (status === "active" || status === "authenticated") return "active";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "expired") return "expired";
  if (status === "halted") return "halted";
  if (status === "paused") return "paused";
  return "pending";
}
