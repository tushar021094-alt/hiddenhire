import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261021085415_restrict_unverified_recruiter_job_insert.sql",
    import.meta.url,
  ),
  "utf8",
);

test("native recruiter job inserts stay owner-bound and pending review", () => {
  assert.match(migration, /posted_by\s*=\s*\(SELECT auth\.uid\(\)\)/i);
  assert.match(migration, /source_type\s*=\s*'native'/i);
  assert.match(migration, /country\s*=\s*'India'/i);
  assert.match(migration, /status\s*=\s*'pending_review'/i);
});

test("employer job inserts require a verified employer profile", () => {
  assert.match(migration, /profile\.role\s*=\s*'employer'/i);
  assert.match(migration, /employer\.recruiter_verified\s+IS\s+TRUE/i);
  assert.match(migration, /JOIN public\.employer_profiles AS employer/i);
});

test("agency job inserts require a verified agency profile", () => {
  assert.match(migration, /profile\.role\s*=\s*'agency'/i);
  assert.match(migration, /agency\.verified\s+IS\s+TRUE/i);
  assert.match(migration, /JOIN public\.agency_profiles AS agency/i);
});

test("the previous role-only insert policy is replaced, not left permissive", () => {
  assert.match(migration, /DROP POLICY IF EXISTS jobs_insert_native_recruiter ON public\.jobs/i);
  assert.match(migration, /CREATE POLICY jobs_insert_native_recruiter/i);
  assert.doesNotMatch(
    migration,
    /profile\.role\s*=\s*ANY\s*\(ARRAY\['employer'::text,\s*'agency'::text\]\)/i,
  );
});
