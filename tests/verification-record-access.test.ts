import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261021172254_revoke_unneeded_verification_record_select.sql",
    import.meta.url,
  ),
  "utf8",
);
const pendingRoute = readFileSync(
  new URL(
    "../app/api/admin/recruiter-verifications/pending/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const reviewRoute = readFileSync(
  new URL(
    "../app/api/admin/recruiter-verifications/review/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("raw verification evidence is not directly selectable by anon or authenticated clients", () => {
  assert.match(
    migration,
    /REVOKE SELECT ON TABLE public\.verification_records FROM anon, authenticated/i,
  );
});

test("admin verification queue uses the guarded RPC, not direct table access", () => {
  assert.match(
    pendingRoute,
    /supabase\.rpc\(\s*"admin_recruiter_verification_queue"/,
  );
  assert.doesNotMatch(pendingRoute, /\.from\(\s*["']verification_records["']\s*\)/);
});

test("admin verification review uses the guarded RPC, not direct table access", () => {
  assert.match(
    reviewRoute,
    /supabase\.rpc\(\s*"admin_review_recruiter_verification"/,
  );
  assert.doesNotMatch(reviewRoute, /\.from\(\s*["']verification_records["']\s*\)/);
});
