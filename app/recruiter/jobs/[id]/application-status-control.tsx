"use client";

import { useState } from "react";

const STATUSES = [
  "applied",
  "reviewing",
  "shortlisted",
  "interview",
  "rejected",
  "hired",
] as const;

type ApplicationStatus = (typeof STATUSES)[number];

export default function ApplicationStatusControl({
  applicationId,
  currentStatus,
  responseDueAt,
}: {
  applicationId: string;
  currentStatus: string;
  responseDueAt?: string | null;
}) {
  const normalizedStatus = STATUSES.includes(
    currentStatus as ApplicationStatus,
  )
    ? (currentStatus as ApplicationStatus)
    : "applied";

  const [status, setStatus] =
    useState<ApplicationStatus>(normalizedStatus);
  const [saving, setSaving] = useState(false);
  const [needsResponse, setNeedsResponse] = useState(Boolean(responseDueAt));
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: ApplicationStatus) {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/applications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId,
          status: nextStatus,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to update application status.",
        );
      }

      setStatus(nextStatus);
      setNeedsResponse(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update application status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {needsResponse && (
        <span className="text-[11px] text-amber-200/70">
          Candidate reminder is awaiting your status update.
        </span>
      )}

      <select
        value={status}
        disabled={saving}
        onChange={(event) =>
          updateStatus(event.target.value as ApplicationStatus)
        }
        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs capitalize text-white/75 outline-none focus:border-cyan-300/40"
      >
        {STATUSES.map((item) => (
          <option
            key={item}
            value={item}
            className="bg-slate-900 text-white"
          >
            {item}
          </option>
        ))}
      </select>

      {saving && (
        <span className="text-[11px] text-white/40">
          Saving…
        </span>
      )}

      {error && (
        <span className="max-w-[220px] text-right text-[11px] text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
