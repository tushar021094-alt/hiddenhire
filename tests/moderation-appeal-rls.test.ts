import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020172300_harden_moderation_appeals.sql", import.meta.url),
  "utf8",
);

test("appeal status decisions can only be updated by HiddenHire admins", () => {
  assert.match(
    migration,
    /drop policy if exists moderation_appeals_update_own[\s\S]*?create policy moderation_appeals_admin_update[\s\S]*?for update[\s\S]*?using\s*\(public\.is_hiddenhire_admin\(\)\)[\s\S]*?with check\s*\(public\.is_hiddenhire_admin\(\)\)/i,
  );
});

test("appeals can only be inserted by the recruiter who owns the matching active case", () => {
  assert.match(migration, /recruiter_id\s*=\s*auth\.uid\(\)/i);
  assert.match(migration, /moderation_case\.id\s*=\s*moderation_appeals\.case_id/i);
  assert.match(migration, /moderation_case\.job_id\s*=\s*moderation_appeals\.job_id/i);
  assert.match(migration, /moderation_case\.decision\s+IN\s*\('restrict',\s*'escalate'\)/i);
  assert.match(migration, /status\s*=\s*'submitted'/i);
  assert.match(migration, /reviewed_at\s+IS\s+NULL/i);
  assert.match(migration, /reviewed_by\s+IS\s+NULL/i);
});

test("appeal tables do not retain unnecessary truncate, delete, or trigger privileges", () => {
  assert.match(migration, /REVOKE ALL ON TABLE public\.moderation_cases FROM anon, authenticated/i);
  assert.match(migration, /REVOKE ALL ON TABLE public\.moderation_appeals FROM anon, authenticated/i);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.moderation_appeals TO authenticated/i);
});

test("active appeals are unique per moderation case", () => {
  assert.match(
    migration,
    /create unique index if not exists moderation_appeals_one_active_per_case[\s\S]*?on public\.moderation_appeals\s*\(case_id\)[\s\S]*?where status IN \('submitted', 'under_review'\)/i,
  );
});
