import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020172500_secure_application_workflow_updates.sql", import.meta.url),
  "utf8",
);
const recruiterStatusControl = readFileSync(
  new URL("../app/recruiter/jobs/[id]/application-status-control.tsx", import.meta.url),
  "utf8",
);
const candidateApplicationsPage = readFileSync(
  new URL("../app/applications/page.tsx", import.meta.url),
  "utf8",
);

test("candidate reminder RPC validates candidate role and application ownership", () => {
  assert.match(migration, /FUNCTION public\.candidate_remind_application\(p_application_id uuid\)/i);
  assert.match(migration, /actor_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /actor_role IS DISTINCT FROM 'candidate'/i);
  assert.match(migration, /application\.candidate_id = actor_id/i);
  assert.match(migration, /FOR UPDATE/i);
});

test("candidate reminder RPC enforces status, five-day eligibility and a three-day cooldown atomically", () => {
  assert.match(migration, /application_row\.status NOT IN \('applied', 'reviewing', 'shortlisted'\)/i);
  assert.match(migration, /application_row\.created_at \+ interval '5 days'/i);
  assert.match(migration, /'code', 'TOO_EARLY'/i);
  assert.match(migration, /last_candidate_reminder_at \+ interval '3 days'/i);
  assert.match(migration, /candidate_reminder_count = next_count/i);
  assert.match(migration, /last_candidate_reminder_at = current_time_at/i);
  const reminderRpc = migration.split("CREATE OR REPLACE FUNCTION public.recruiter_update_application_status")[0];
  assert.match(reminderRpc, /last_candidate_reminder_at = current_time_at/i);
  assert.doesNotMatch(reminderRpc, /INSERT INTO public\.notifications/i);
});

test("recruiter status RPC validates role, job ownership and UI-supported status choices", () => {
  assert.ok(migration.includes("FUNCTION public.recruiter_update_application_status("));
  assert.ok(migration.includes("p_status text"));
  assert.match(migration, /actor_role IS DISTINCT FROM 'employer' AND actor_role IS DISTINCT FROM 'agency'/i);
  assert.match(migration, /job_row\.posted_by IS DISTINCT FROM actor_id/i);
  assert.ok(migration.includes("p_status IS NULL OR p_status NOT IN ('reviewing', 'shortlisted', 'interview', 'rejected', 'hired')"));
  assert.match(migration, /application_row\.status = 'applied' AND p_status = 'reviewing'/i);
  assert.match(migration, /application_row\.status = 'reviewing' AND p_status IN \('shortlisted', 'interview', 'rejected'\)/i);
  assert.match(migration, /application_row\.status = 'shortlisted' AND p_status IN \('interview', 'rejected', 'hired'\)/i);
  assert.match(migration, /application_row\.status = 'interview' AND p_status IN \('hired', 'rejected'\)/i);
  assert.match(migration, /'code', 'INVALID_TRANSITION'/i);
  assert.match(migration, /'application_status'/i);
});

test("application workflow RPC execution is authenticated-only", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.candidate_remind_application\(uuid\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.candidate_remind_application\(uuid\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.recruiter_update_application_status\(uuid, text\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.recruiter_update_application_status\(uuid, text\) TO authenticated/i);
});

test("recruiter selector offers only forward transitions allowed by the database trigger", () => {
  assert.match(recruiterStatusControl, /applied:\s*\["applied",\s*"reviewing"\]/);
  assert.match(recruiterStatusControl, /reviewing:\s*\["reviewing",\s*"shortlisted",\s*"interview",\s*"rejected"\]/);
  assert.match(recruiterStatusControl, /shortlisted:\s*\["shortlisted",\s*"interview",\s*"rejected",\s*"hired"\]/);
  assert.match(recruiterStatusControl, /interview:\s*\["interview",\s*"rejected",\s*"hired"\]/);
  assert.match(recruiterStatusControl, /disabled=\{saving \|\| statusLocked\}/);
});

test("candidate withdraw action is offered only while the database trigger allows withdrawal", () => {
  assert.match(candidateApplicationsPage, /\["applied", "reviewing", "shortlisted"\]\.includes\(application\.status\)/);
});



test("candidate withdrawal is owner-checked inside an RPC and allows only withdrawable stages", () => {
  assert.ok(migration.includes("FUNCTION public.candidate_withdraw_application(p_application_id uuid)"));
  assert.ok(migration.includes("application.candidate_id = actor_id"));
  assert.ok(migration.includes("application_row.status NOT IN ('applied', 'reviewing', 'shortlisted')"));
  assert.ok(migration.includes("SET status = 'withdrawn'"));
  assert.ok(migration.includes("'code', 'NOT_FOUND'"));
  assert.ok(migration.includes("'code', 'INVALID_STATUS'"));
  assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.candidate_withdraw_application(uuid) FROM PUBLIC, anon"));
  assert.ok(migration.includes("GRANT EXECUTE ON FUNCTION public.candidate_withdraw_application(uuid) TO authenticated"));
});

test("authenticated clients cannot bypass application workflow RPCs with direct status updates", () => {
  assert.ok(migration.includes("REVOKE UPDATE (status) ON TABLE public.applications FROM PUBLIC, anon, authenticated"));
  const applicationsRoute = readFileSync(new URL("../app/api/applications/route.ts", import.meta.url), "utf8");
  assert.ok(applicationsRoute.includes('"candidate_withdraw_application"'));
  assert.doesNotMatch(applicationsRoute, /\.from\(["']applications["']\)\s*\.update\(\{\s*status:\s*["']withdrawn["']/i);
});
