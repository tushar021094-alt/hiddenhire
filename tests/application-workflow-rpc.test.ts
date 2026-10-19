import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020140000_secure_application_workflow_updates.sql", import.meta.url),
  "utf8",
);

test("candidate reminder RPC validates candidate role and application ownership", () => {
  assert.match(migration, /FUNCTION public\.candidate_remind_application\(p_application_id uuid\)/i);
  assert.match(migration, /actor_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /actor_role IS DISTINCT FROM 'candidate'/i);
  assert.match(migration, /application\.candidate_id = actor_id/i);
  assert.match(migration, /FOR UPDATE/i);
});

test("candidate reminder RPC enforces status and a three-day cooldown atomically", () => {
  assert.match(migration, /application_row\.status NOT IN \('applied', 'reviewing', 'shortlisted'\)/i);
  assert.match(migration, /last_candidate_reminder_at \+ interval '3 days'/i);
  assert.match(migration, /candidate_reminder_count = next_count/i);
  assert.match(migration, /last_candidate_reminder_at = current_time_at/i);
  assert.match(migration, /'application_reminder'/i);
});

test("recruiter status RPC validates role, job ownership and permitted status transitions", () => {
  assert.match(migration, /FUNCTION public\.recruiter_update_application_status\([\s\S]*?p_status text\)/i);
  assert.match(migration, /actor_role IS DISTINCT FROM 'employer' AND actor_role IS DISTINCT FROM 'agency'/i);
  assert.match(migration, /job_row\.posted_by IS DISTINCT FROM actor_id/i);
  assert.match(migration, /application_row\.status = 'applied' AND p_status = 'reviewing'/i);
  assert.match(migration, /application_row\.status = 'interview' AND p_status IN \('hired', 'rejected'\)/i);
  assert.match(migration, /'application_status'/i);
});

test("application workflow RPC execution is authenticated-only", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.candidate_remind_application\(uuid\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.candidate_remind_application\(uuid\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.recruiter_update_application_status\(uuid, text\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.recruiter_update_application_status\(uuid, text\) TO authenticated/i);
});
