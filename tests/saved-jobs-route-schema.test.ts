import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261023122103_add_saved_job_display_fields.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../app/api/saved-jobs/route.ts", import.meta.url),
  "utf8",
);

test("saved-job display metadata is added safely for existing databases", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS title text/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS company text/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS location text/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS remote boolean/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS salary_min numeric/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS salary_max numeric/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS currency text/i);
});

test("saved jobs API only selects display columns backed by the additive migration", () => {
  const selected = route.match(/\.select\("([^"]+)"\)/)?.[1] ?? "";
  for (const column of ["title", "company", "location", "remote", "salary_min", "salary_max", "currency"]) {
    assert.ok(selected.split(/,\s*/).includes(column), `missing selected saved_jobs column: ${column}`);
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\s`, "i"));
  }
});
