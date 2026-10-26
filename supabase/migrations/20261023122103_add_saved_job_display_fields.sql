-- Add optional display metadata used by the Saved Jobs UI and API.
-- Existing saves remain valid; all new fields are nullable for legacy rows.
ALTER TABLE public.saved_jobs
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS remote boolean,
  ADD COLUMN IF NOT EXISTS salary_min numeric,
  ADD COLUMN IF NOT EXISTS salary_max numeric,
  ADD COLUMN IF NOT EXISTS currency text;
