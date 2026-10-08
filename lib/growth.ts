type GrowthEventName =
  | "landing_view"
  | "search_started"
  | "auth_prompt_shown"
  | "match_results_viewed"
  | "application_click"
  | "signup_started"
  | "signup_completed"
  | "login_completed"
  | "job_post_started"
  | "job_post_completed";

const SESSION_KEY = "hiddenhire-growth-session";

function getSessionId() {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function trackGrowthEvent(
  eventName: GrowthEventName,
  metadata: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const payload = {
    eventName,
    sessionId: getSessionId(),
    path: window.location.pathname,
    referrer: document.referrer || null,
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    content: params.get("utm_content"),
    term: params.get("utm_term"),
    metadata,
  };

  const body = JSON.stringify(payload);

  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/growth/event", blob)) return;
  } catch {
    // Fall back to fetch below.
  }

  void fetch("/api/growth/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Growth tracking must never interrupt the product experience.
  });
}
