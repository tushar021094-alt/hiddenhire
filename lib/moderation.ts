import type { JobStatus } from "./marketplace";

/**import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
const router = useRouter();
const supabase = createClient();
useEffect(() => {
  let active = true;

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (active && !user) {
      router.replace("/login");
    }
  }

  void checkAuth();

  return () => {
    active = false;
  };
}, [router, supabase]);
 * HiddenHire V1 job publishing/moderation types.
 *
 * The checks in this module are server-side helpers that give the API route a
 * fast, predictable error before it calls the database. The authoritative
 * authorization and job-validity rules live in
 * supabase/migrations/20260929_job_moderation.sql, so a client can never bypass
 * them.
 */

/** Moderation actions an admin may perform on a pending_review native job. */
export const MODERATION_ACTIONS = ["publish", "reject"] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/** public.jobs.status written by each moderation action. */
export const MODERATION_ACTION_STATUS: Record<ModerationAction, JobStatus> = {
  publish: "published",
  reject: "rejected",
};

/** public.moderation_events.action vocabulary written by the moderation RPCs. */
export const MODERATION_EVENT_ACTION: Record<ModerationAction, string> = {
  publish: "publish",
  reject: "reject",
};

export const PENDING_REVIEW_STATUS = "pending_review";
export const NATIVE_JOB_SOURCE_TYPE = "native";
export const NATIVE_JOB_COUNTRY = "India";

/** Mirrors the char_length check inside public.admin_reject_job. */
export const MAX_MODERATION_REASON_LENGTH = 500;

export type ModerationRequest = {
  jobId: string;
  action: ModerationAction;
  reason: string | null;
};

export type ModerationRequestResult =
  | { ok: true; request: ModerationRequest }
  | { ok: false; error: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isModerationJobId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function isModerationAction(value: unknown): value is ModerationAction {
  return (
    typeof value === "string" &&
    (MODERATION_ACTIONS as readonly string[]).includes(value.trim().toLowerCase())
  );
}

/**
 * Validates the request body of POST /api/admin/jobs/moderate.
 * The action is never used for authorization; the database re-checks the
 * caller's role for every action.
 */
export function parseModerationRequest(payload: unknown): ModerationRequestResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "A moderation request body is required." };
  }

  const record = payload as Record<string, unknown>;

  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";

  if (!isModerationJobId(jobId)) {
    return { ok: false, error: "A valid jobId is required." };
  }

  const action =
    typeof record.action === "string" ? record.action.trim().toLowerCase() : "";

  if (!isModerationAction(action)) {
    return { ok: false, error: "action must be either publish or reject." };
  }

  // A reason only applies to rejection. It is optional, trimmed, and ignored for
  // other actions.
  if (action !== "reject" || record.reason === undefined || record.reason === null) {
    return { ok: true, request: { jobId, action, reason: null } };
  }

  if (typeof record.reason !== "string") {
    return { ok: false, error: "The rejection reason must be text." };
  }

  const reason = record.reason.trim() || null;

  if (reason && reason.length > MAX_MODERATION_REASON_LENGTH) {
    return {
      ok: false,
      error: `The rejection reason must be ${MAX_MODERATION_REASON_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true, request: { jobId, action, reason } };
}

/** The subset of public.jobs the moderation pre-checks need. */
export type ModeratableJobRow = {
  id: string;
  source_type: string | null;
  status: string | null;
  country: string | null;
  title: string | null;
  description: string | null;
};

export type ModerationEligibility = { ok: true } | { ok: false; error: string };

/**
 * Mirrors the validation performed inside public.admin_publish_job and
 * public.admin_reject_job. Only native HiddenHire jobs that are still
 * pending_review can be moderated; publishing additionally requires a native
 * India job with a title and description.
 */
export function assessModerationEligibility(
  job: ModeratableJobRow,
  action: ModerationAction,
): ModerationEligibility {
  const verb = action === "publish" ? "published" : "rejected";

  if (job.source_type !== NATIVE_JOB_SOURCE_TYPE) {
    return {
      ok: false,
      error: `Only HiddenHire native jobs can be ${verb} through moderation.`,
    };
  }

  if (job.status !== PENDING_REVIEW_STATUS) {
    return {
      ok: false,
      error: `Only jobs pending review can be ${verb}. This job is currently ${
        job.status ?? "unknown"
      }.`,
    };
  }

  if (action === "publish") {
    if (
      (job.country ?? "").trim().toLowerCase() !== NATIVE_JOB_COUNTRY.toLowerCase()
    ) {
      return { ok: false, error: "Only native India jobs can be published." };
    }

    if (!(job.title ?? "").trim() || !(job.description ?? "").trim()) {
      return {
        ok: false,
        error: "A job requires a title and a description before it can be published.",
      };
    }
  }

  return { ok: true };
}

/** PostgREST error shape returned by supabase.rpc(). */
export type ModerationDatabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const MODERATION_ERROR_STATUS: Record<string, number> = {
  // raised by the moderation RPCs for authorization failures (non-admin caller)
  "42501": 403,
  // the job id does not exist
  P0002: 404,
  // invalid job state, missing title/description, invalid reason length
  "22023": 400,
};

export function moderationHttpStatusFor(
  error: ModerationDatabaseError | null | undefined,
): number {
  if (!error?.code) {
    return 500;
  }

  return MODERATION_ERROR_STATUS[error.code] ?? 500;
}

export function moderationErrorBody(
  error: ModerationDatabaseError | null | undefined,
  fallback = "Job moderation failed. Please try again.",
): { error: string } {
  return { error: error?.message?.trim() || fallback };
}