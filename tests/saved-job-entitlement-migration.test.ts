import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261018_enforce_saved_job_entitlements.sql"),
  "utf8",
);

test("saved-job entitlement RPC serializes requests per user", () => {
  assert.ok(migration.includes("pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0))"));
});

test("saved-job entitlement RPC checks latest subscription and free limit", () => {
  assert.ok(migration.includes("order by s.created_at desc"));
  assert.ok(migration.includes("s.current_period_end is null or s.current_period_end > now()"));
  assert.ok(migration.includes("v_count >= 10"));
  assert.ok(migration.includes("'limitReached', true"));
});

test("saved-job entitlement RPC treats existing saves as idempotent", () => {
  assert.ok(migration.includes("return jsonb_build_object('savedJob', v_existing, 'created', false)"));
});

test("saved-job entitlement RPC is candidate-only and blocks direct-insert bypass", () => {
  assert.ok(migration.includes("v_role is distinct from 'candidate'"));
  assert.ok(migration.includes("revoke insert on public.saved_jobs from authenticated"));
  assert.ok(migration.includes("revoke insert (profile_id, external_job_id, job_id, source, job_url, score, status)"));
  assert.ok(migration.includes("grant execute on function public.save_job_with_entitlement(jsonb, boolean) to authenticated"));
});
