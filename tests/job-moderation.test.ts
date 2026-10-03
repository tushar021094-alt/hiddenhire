import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { jobValidityDays } from "../lib/marketplace.ts";
import {
  MAX_MODERATION_REASON_LENGTH,
  MODERATION_ACTION_STATUS,
  MODERATION_EVENT_ACTION,
  assessModerationEligibility,
  isModerationAction,
  isModerationJobId,
  moderationErrorBody,
  moderationHttpStatusFor,
  parseModerationRequest,
  type ModeratableJobRow,
} from "../lib/moderation.ts";

const JOB_ID = "6f0bdc5c-3f2f-4a5a-9b0f-0db6f5e7a111";

const migrationPath = new URL(
  "../supabase/migrations/20260929_job_moderation.sql",
  import.meta.url,
);

const migrationSql = readFileSync(migrationPath, "utf8");

/** SQL with `--` comments removed, so guardrail tests only inspect real code. */
function executableSql(sql: string) {
  return sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** Top-level SQL with SECURITY DEFINER function bodies collapsed. */
const outerSql = executableSql(migrationSql).replace(/\$\$[\s\S]*?\$\$/g, "$$body$$");

const functionBodies = [...executableSql(migrationSql).matchAll(/\$\$([\s\S]*?)\$\$/g)].map(
  (match) => match[1],
);

const publishBody = functionBodies.find((body) => body.includes("'published'::text"));
const rejectBody = functionBodies.find((body) => body.includes("'rejected'::text"));

function job(overrides: Partial<ModeratableJobRow> = {}): ModeratableJobRow {
  return {
    id: JOB_ID,
    source_type: "native",
    status: "pending_review",
    country: "India",
    title: "Finance Manager",
    description: "Own FP&A for a growing India team.",
    ...overrides,
  };
}

test("publish request parses without a rejection reason", () => {
  const parsed = parseModerationRequest({ jobId: JOB_ID, action: "publish" });

  assert.ok(parsed.ok);
  assert.deepEqual(parsed.request, {
    jobId: JOB_ID,
    action: "publish",
    reason: null,
  });
});

test("publish request ignores a supplied reason", () => {
  const parsed = parseModerationRequest({
    jobId: ` ${JOB_ID} `,
    action: "PUBLISH",
    reason: "not applicable",
  });

  assert.ok(parsed.ok);
  assert.equal(parsed.request.jobId, JOB_ID);
  assert.equal(parsed.request.action, "publish");
  assert.equal(parsed.request.reason, null);
});

test("reject request keeps a trimmed rejection reason", () => {
  const parsed = parseModerationRequest({
    jobId: JOB_ID,
    action: "reject",
    reason: "  Location anomaly detected.  ",
  });

  assert.ok(parsed.ok);
  assert.deepEqual(parsed.request, {
    jobId: JOB_ID,
    action: "reject",
    reason: "Location anomaly detected.",
  });
});

test("reject request treats a blank reason as no reason", () => {
  const parsed = parseModerationRequest({
    jobId: JOB_ID,
    action: "reject",
    reason: "   ",
  });

  assert.ok(parsed.ok);
  assert.equal(parsed.request.reason, null);
});

test("moderation request rejects malformed input", () => {
  const cases: unknown[] = [
    null,
    "publish",
    [],
    {},
    { jobId: "not-a-uuid", action: "publish" },
    { jobId: JOB_ID },
    { jobId: JOB_ID, action: "approve" },
    { jobId: JOB_ID, action: "reject", reason: 42 },
    {
      jobId: JOB_ID,
      action: "reject",
      reason: "x".repeat(MAX_MODERATION_REASON_LENGTH + 1),
    },
  ];

  for (const payload of cases) {
    const parsed = parseModerationRequest(payload);
    assert.equal(parsed.ok, false, `expected ${JSON.stringify(payload)} to be rejected`);
    if (!parsed.ok) {
      assert.ok(parsed.error.length > 0);
    }
  }
});

test("moderation guards validate ids and actions", () => {
  assert.equal(isModerationJobId(JOB_ID), true);
  assert.equal(isModerationJobId(`${JOB_ID} `), true);
  assert.equal(isModerationJobId("123"), false);
  assert.equal(isModerationAction("reject"), true);
  assert.equal(isModerationAction("REJECT"), true);
  assert.equal(isModerationAction("delete"), false);
});

test("moderation status vocabulary matches the V1 job statuses", () => {
  assert.equal(MODERATION_ACTION_STATUS.publish, "published");
  assert.equal(MODERATION_ACTION_STATUS.reject, "rejected");
  assert.equal(MODERATION_EVENT_ACTION.publish, "publish");
  assert.equal(MODERATION_EVENT_ACTION.reject, "reject");
});

test("moderation database errors map to HTTP statuses", () => {
  assert.equal(moderationHttpStatusFor({ code: "42501", message: "denied" }), 403);
  assert.equal(moderationHttpStatusFor({ code: "P0002", message: "missing" }), 404);
  assert.equal(moderationHttpStatusFor({ code: "22023", message: "invalid" }), 400);
  assert.equal(moderationHttpStatusFor({ code: "XX000" }), 500);
  assert.equal(moderationHttpStatusFor(null), 500);
  assert.deepEqual(moderationErrorBody({ code: "42501", message: " Admin only. " }), {
    error: "Admin only.",
  });
  assert.deepEqual(moderationErrorBody(null, "fallback message"), {
    error: "fallback message",
  });
});

test("publish eligibility accepts a native India job pending review", () => {
  assert.deepEqual(assessModerationEligibility(job(), "publish"), { ok: true });
});

test("reject eligibility accepts a native job pending review", () => {
  assert.deepEqual(assessModerationEligibility(job(), "reject"), { ok: true });
  // Rejecting a non-India native job is still a valid moderation action.
  assert.deepEqual(
    assessModerationEligibility(job({ country: "United States" }), "reject"),
    { ok: true },
  );
});

test("non-native jobs can never be moderated", () => {
  for (const action of ["publish", "reject"] as const) {
    const eligibility = assessModerationEligibility(
      job({ source_type: "greenhouse" }),
      action,
    );
    assert.equal(eligibility.ok, false);
  }
});

test("only pending_review jobs can be moderated", () => {
  for (const status of ["draft", "published", "rejected", "paused", "closed"]) {
    const eligibility = assessModerationEligibility(job({ status }), "publish");
    assert.equal(eligibility.ok, false);
  }
});

test("publishing requires a native India job with content", () => {
  assert.equal(assessModerationEligibility(job({ country: null }), "publish").ok, false);
  assert.equal(
    assessModerationEligibility(job({ country: "United States" }), "publish").ok,
    false,
  );
  assert.equal(assessModerationEligibility(job({ title: " " }), "publish").ok, false);
  assert.equal(
    assessModerationEligibility(job({ description: "" }), "publish").ok,
    false,
  );
});

test("the migration mirrors the existing V1 native job validity rule", () => {
  // lib/marketplace.ts holds the application rule that the SQL mirrors.
  assert.equal(jobValidityDays("employer_free"), 15);
  assert.equal(jobValidityDays("employer_starter"), 30);
  assert.equal(jobValidityDays("employer_growth"), 30);
  assert.equal(jobValidityDays("agency"), 30);

  assert.match(
    executableSql(migrationSql),
    /'employer_free'\s+then\s+15\s+else\s+30/,
  );
});

test("the moderation migration exposes admin-only moderation RPCs", () => {
  assert.match(
    outerSql,
    /create function public\.admin_publish_job\(p_job_id uuid\)/,
  );
  assert.match(
    outerSql,
    /create function public\.admin_reject_job\(p_job_id uuid, p_reason text default null\)/,
  );
  assert.match(
    outerSql,
    /revoke all on function public\.admin_publish_job\(uuid\) from public, anon, authenticated;/,
  );
  assert.match(
    outerSql,
    /grant execute on function public\.admin_publish_job\(uuid\)\s+to authenticated;/,
  );
  assert.match(
    outerSql,
    /revoke all on function public\.admin_reject_job\(uuid, text\) from public, anon, authenticated;/,
  );
  assert.match(
    outerSql,
    /grant execute on function public\.admin_reject_job\(uuid, text\)\s+to authenticated;/,
  );
});

test("both moderation RPCs authorize the caller database-side", () => {
  assert.ok(publishBody, "publish function body was not found");
  assert.ok(rejectBody, "reject function body was not found");

  for (const body of [publishBody ?? "", rejectBody ?? ""]) {
    assert.match(body, /actor_role <> 'admin'/);
    assert.match(body, /from public\.profiles as profile/);
    assert.match(body, /insert into public\.moderation_events/);
    assert.match(body, /insert into public\.audit_events/);
    assert.match(body, /'job',/); // audit entity_type
  }
});

test("publishing sets the status, published_at and expires_at", () => {
  const body = publishBody ?? "";

  assert.match(body, /v1_current_plan_id\(moderation_job\.posted_by\)/);
  assert.match(body, /v1_job_validity_days\(resolved_plan_id\)/);
  assert.match(body, /status = 'published'/);
  assert.match(body, /published_at = resolved_published_at/);
  assert.match(body, /expires_at = resolved_expires_at/);
  assert.match(body, /make_interval\(days => resolved_validity_days\)/);
  assert.match(body, /status is distinct from 'pending_review'/);
  assert.match(body, /source_type is distinct from 'native'/);
  assert.match(body, /<> 'india'/);
});

test("rejecting records the reason without publishing the job", () => {
  const body = rejectBody ?? "";

  assert.match(
    body,
    /resolved_reason := nullif\(btrim\(coalesce\(p_reason, ''\)\), ''\)/,
  );
  assert.match(body, /status = 'rejected'/);
  assert.match(body, /char_length\(resolved_reason\) > 500/);
  assert.doesNotMatch(body, /status = 'published'/);
  assert.doesNotMatch(body, /expires_at =/);
});

test("the migration never grants write access to moderation or audit history", () => {
  // Top-level statements only: function bodies are collapsed in outerSql.
  assert.doesNotMatch(outerSql, /grant\s+(insert|update|delete|all|truncate)\b/i);
  assert.doesNotMatch(outerSql, /grant\s+select[^;]*on public\.jobs/i);
  assert.match(
    outerSql,
    /grant select on public\.moderation_events to authenticated;/,
  );
  assert.match(outerSql, /grant select on public\.audit_events to authenticated;/);

  // No write grants anywhere in the file, including inside function bodies.
  assert.doesNotMatch(
    executableSql(migrationSql),
    /grant\s+(insert|update|delete|all)\b/i,
  );
  // The file documents the deliberate non-grants so they are not "fixed" later.
  assert.match(migrationSql, /No `grant insert`\/`update`\/`delete`/);
  assert.match(migrationSql, /No `grant update` on public\.jobs/);
});

test("jobs keeps its write security: no new update grant or write policy", () => {
  assert.doesNotMatch(executableSql(migrationSql), /for update\s+to\s+authenticated/i);

  const policyStatements = outerSql
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement.startsWith("create policy"));

  assert.ok(policyStatements.length >= 3, "expected the admin read policies");
  for (const statement of policyStatements) {
    assert.match(statement, /for select to authenticated/);
    assert.doesNotMatch(statement, /for (update|insert|delete|all)\b/);
  }
});

test("admin accounts stay manually provisioned (no admin signup flow)", () => {
  assert.match(migrationSql, /update public\.profiles set role = 'admin'/);
  // No self-serve way to obtain the role: no admin literal outside the checks
  // and no profile write path.
  assert.doesNotMatch(outerSql, /'admin'/);
  assert.doesNotMatch(executableSql(migrationSql), /insert into public\.profiles/i);
});