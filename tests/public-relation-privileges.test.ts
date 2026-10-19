import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020130000_revoke_excess_public_relation_privileges.sql", import.meta.url),
  "utf8",
);

test("public tables revoke unnecessary DDL and maintenance privileges from application roles", () => {
  assert.match(
    migration,
    /REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN\s+ON ALL TABLES IN SCHEMA public\s+FROM anon, authenticated/i,
  );
});

test("future public tables created by the migration role do not inherit excess privileges", () => {
  assert.match(
    migration,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES\s+FROM anon, authenticated/i,
  );
});

test("public relation privilege cleanup preserves normal CRUD grants", () => {
  assert.doesNotMatch(migration, /REVOKE ALL ON ALL TABLES IN SCHEMA public/i);
  assert.doesNotMatch(migration, /REVOKE SELECT, INSERT, UPDATE, DELETE/i);
});
