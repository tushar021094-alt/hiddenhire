import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020182131_secure_career_execution_tasks.sql", import.meta.url),
  "utf8",
);
const apiPaths = [
  "../app/api/career-execution/tasks/route.ts",
  "../app/api/career-network/action/route.ts",
  "../app/api/career-operations/enqueue/route.ts",
];
const apiSources = apiPaths.map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
const executionComponent = readFileSync(new URL("../components/career-agent-execution.tsx", import.meta.url), "utf8");

test("career task table mutations are revoked from direct authenticated clients", () => {
  assert.match(migration, /REVOKE ALL ON TABLE public\.career_execution_tasks FROM anon, authenticated/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.career_execution_tasks TO authenticated/i);
  assert.match(migration, /REVOKE INSERT \([\s\S]*?\)\s+ON TABLE public\.career_execution_tasks FROM anon, authenticated/i);
  assert.match(migration, /REVOKE UPDATE \([\s\S]*?\)\s+ON TABLE public\.career_execution_tasks FROM anon, authenticated/i);
});

test("task creation is candidate-only, owner-scoped, idempotent and approval-gates side effects", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_career_execution_task/i);
  assert.match(migration, /actor_role IS DISTINCT FROM 'candidate'/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(actor_id::text, 0\)\)/i);
  assert.match(migration, /v_requires_approval := coalesce\(p_requires_approval, true\)\s+OR v_action IN \('apply', 'follow_up'\)/i);
  assert.match(migration, /v_state := CASE WHEN v_requires_approval THEN 'awaiting_approval' ELSE 'queued' END/i);
  assert.match(migration, /career_execution_tasks_one_active_operation/i);
});

test("task transitions require an explicit persisted approval before side-effecting execution", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.transition_career_execution_task/i);
  assert.match(migration, /v_task\.state = 'awaiting_approval' AND v_task\.requires_approval/i);
  assert.match(migration, /v_task\.state = 'approved'\s+AND v_task\.approved_at IS NOT NULL/i);
  assert.match(migration, /v_task\.state = 'queued'\s+AND NOT v_task\.requires_approval\s+AND v_task\.action NOT IN \('apply', 'follow_up'\)/i);
});

test("pending Apply and Follow-up tasks are moved back to approval before execution", () => {
  assert.match(migration, /UPDATE public\.career_execution_tasks[\s\S]*?SET requires_approval = true,[\s\S]*?state = 'awaiting_approval'/i);
  assert.match(migration, /WHERE action IN \('apply', 'follow_up'\)[\s\S]*?state IN \('queued', 'awaiting_approval', 'approved', 'executing'\)/i);
});

test("career task APIs use the guarded RPCs rather than direct table writes", () => {
  assert.match(apiSources[0], /rpc\("create_career_execution_task"/i);
  assert.match(apiSources[0], /rpc\("transition_career_execution_task"/i);
  assert.match(apiSources[1], /rpc\("create_career_execution_task"/i);
  assert.match(apiSources[2], /rpc\("create_career_execution_task"/i);
  for (const source of apiSources) {
    assert.doesNotMatch(source, /from\(["']career_execution_tasks["']\)\.(?:insert|update)/i);
  }
});

test("career-task RPCs are callable only by authenticated users", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_career_execution_task\(text, text, text, boolean, uuid, text\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_career_execution_task\(text, text, text, boolean, uuid, text\) TO authenticated/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.transition_career_execution_task\(uuid, text\) FROM PUBLIC, anon/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.transition_career_execution_task\(uuid, text\) TO authenticated/i);
});

test("safe queued tasks expose a Start control without bypassing Apply or Follow-up approvals", () => {
  assert.match(executionComponent, /task\.state === "queued" && !task\.requires_approval && !\["apply", "follow_up"\]\.includes\(task\.action\)/);
});


test("career task template submissions include stable operation ids for deduplication", () => {
  assert.ok(executionComponent.includes('operationId: `agent-task:${template.action}`'));
});


test("career task queue distinguishes a new task from an idempotent duplicate", () => {
  assert.match(executionComponent, /data\.deduplicated === true[\s\S]*?no duplicate was created/);
  assert.match(executionComponent, /Task queued and waiting for your approval/);
});
