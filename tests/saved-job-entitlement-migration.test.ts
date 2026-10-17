import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261018_enforce_saved_job_entitlements.sql"),
  "utf8",
);

test("saved-job entitlement RPC serializes requests per user", () => {
  assert.match(migration, /pg_advisory_xact_lock\\(hashtextextended\\(v_user_id::text, 0\\)\\)/);
});

test("saved-job entitlement RPC checks latest subscription and free limit", () => {
  assert.match(migration, /order by s\\.created_at desc\\s+limit 1/i);
  assert.match(migration, /s\\.current_period_end is null or s\\.current_period_end > now\\(\\)/i);
  assert.match(migration, /v_count >= 10/);
  assert.match(migration, /'limitReached', true/);
});

test("saved-job entitlement RPC treats existing saves as idempotent", () => {
  assert.match(migration, /if v_existing is not null then\\s+return jsonb_build_object\\('savedJob', v_existing, 'created', false\\)/i);
});

test("saved-job entitlement RPC is candidate-only and blocks direct-insert bypass", () => {
  assert.match(migration, /v_role is distinct from 'candidate'/);
  assert.match(migration, /revoke insert on public\\.saved_jobs from authenticated/i);
  assert.match(migration, /grant execute on function public\\.save_job_with_entitlement\\(jsonb, boolean\\) to authenticated/i);
});
