-- Keep the application-facing database roles least-privileged.
-- Supabase's Postgres 17 public-schema ACLs currently grant anon/authenticated
-- table maintenance and DDL-adjacent privileges that the web application never
-- needs. RLS does not govern TRUNCATE, so remove these privileges explicitly.
--
-- Review-only migration. Do not apply to Production outside the approved
-- migration window. This affects only the public schema and preserves CRUD
-- grants/policies intentionally used by the application.

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Ensure future application tables created by the postgres migration role do
-- not inherit these unnecessary privileges again.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES
  FROM anon, authenticated;

-- This SECURITY DEFINER routine is a trigger function in the unexposed private
-- schema, not an application RPC. Trigger execution does not require exposing it
-- as an independently callable API function.
REVOKE ALL ON FUNCTION private.notify_application_reminder() FROM PUBLIC, anon, authenticated;
