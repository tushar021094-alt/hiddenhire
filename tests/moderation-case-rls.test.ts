import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020110000_restrict_moderation_case_reads.sql", import.meta.url),
  "utf8",
);

test("moderation case reads are restricted to the assigned recruiter and HiddenHire admins", () => {
  assert.match(
    migration,
    /drop policy if exists moderation_cases_authenticated_select\s+on public\.moderation_cases/i,
  );
  assert.match(
    migration,
    /create policy moderation_cases_admin_or_owner_select[\\s\\S]*?for select\\s+to authenticated\\s+using\\s*\\(public\\.is_hiddenhire_admin\\(\\)\\s+OR\\s+recruiter_id\\s*=\\s*auth\\.uid\\(\\)\\)/i,
  );
  assert.doesNotMatch(
    migration,
    /create policy moderation_cases_[\s\S]*?using\s*\(\s*true\s*\)/i,
  );
});
