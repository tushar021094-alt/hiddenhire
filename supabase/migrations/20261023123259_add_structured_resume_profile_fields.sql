-- Persist structured resume extraction and separate AI suggestions from saved preferences.
-- All fields are additive and have safe defaults for existing candidate profiles.
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS work_experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS resume_summary text,
  ADD COLUMN IF NOT EXISTS recommended_target_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS suggested_salary_min numeric,
  ADD COLUMN IF NOT EXISTS suggested_salary_max numeric,
  ADD COLUMN IF NOT EXISTS suggested_salary_currency text,
  ADD COLUMN IF NOT EXISTS salary_recommendation_rationale text,
  ADD COLUMN IF NOT EXISTS salary_recommendation_confidence text;
