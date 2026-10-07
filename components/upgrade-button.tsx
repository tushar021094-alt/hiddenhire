"use client";

import { useState } from "react";

export function UpgradeButton({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout."
      );
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="hh-upgrade-action">
        <button type="button" disabled className="hh-plan-button is-primary">
          Razorpay setup pending <span>•</span>
        </button>
        <p className="hh-upgrade-error hh-upgrade-info">
          Payment credentials are not configured on the production environment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="hh-upgrade-action">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className="hh-plan-button is-primary"
      >
        {busy ? "Opening secure checkout…" : "Upgrade to Candidate Plus"} <span>→</span>
      </button>
      {error && <p className="hh-upgrade-error">{error}</p>}
    </div>
  );
}
