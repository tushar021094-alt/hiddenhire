import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entitlements = readFileSync(new URL("../lib/entitlements.ts", import.meta.url), "utf8");
const pricing = readFileSync(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");
const profilePage = readFileSync(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
const resumeRoute = readFileSync(new URL("../app/api/profile/resume/route.ts", import.meta.url), "utf8");
const openaiRoute = readFileSync(new URL("../app/api/openai/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261023175122_enforce_ai_feature_quotas.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("Free plan keeps manual setup and Plus is ₹299 with bounded AI allowances", () => {
  assert.match(entitlements, /candidate_free:[\s\S]*?monthlyPriceInr:0, limits:\{saved_jobs:10,ai_resume_imports:0,ai_job_match_explanations:0/);
  assert.match(entitlements, /candidate_plus:[\s\S]*?monthlyPriceInr:299, limits:\{saved_jobs:Infinity,ai_resume_imports:5,ai_job_match_explanations:10/);
  assert.match(pricing, /Manual profile setup and editing/);
  assert.match(pricing, /AI resume auto-fill · 5 PDF imports \/ month/);
  const freePlanBlock = pricing.slice(pricing.indexOf('title="Free"'), pricing.indexOf('title="Candidate Plus"'));
  assert.doesNotMatch(freePlanBlock, /AI resume|AI cover|AI interview|AI job matching/i);
  assert.match(schema, /\('candidate_plus','candidate','Candidate Plus',29900,'INR'\)/);
});

test("resume auto-fill is shown only when billing status identifies an active Candidate Plus plan", () => {
  assert.match(profilePage, /setCanUseResumeAI\(billingData\.plan === "candidate_plus"\)/);
  assert.match(profilePage, /canUseResumeAI \? \(/);
  assert.match(profilePage, /Explore Candidate Plus/);
});

test("resume import API requires Plus, uses a persistent monthly quota, and caps output tokens", () => {
  assert.match(resumeRoute, /getActivePlanId\(supabase, user\.id\) !== "candidate_plus"/);
  assert.match(resumeRoute, /p_feature_key: "resume_import"/);
  assert.match(resumeRoute, /max_output_tokens: 4000/);
  assert.match(resumeRoute, /checkRateLimit\(`resume-import:/);
});

test("OpenAI-generated job-match explanations require a monthly Plus quota and cap output tokens", () => {
  assert.match(openaiRoute, /p_feature_key: "resume_job_match"/);
  assert.match(openaiRoute, /max_tokens: 600/);
});

test("quota function checks role and live paid subscription, atomically limits monthly usage, and blocks direct access", () => {
  assert.match(migration, /alter table public\.ai_feature_usage enable row level security/i);
  assert.match(migration, /revoke all on table public\.ai_feature_usage from anon, authenticated/i);
  assert.match(migration, /v_role is distinct from 'candidate'/i);
  assert.match(migration, /v_plan_id is distinct from 'candidate_plus'/i);
  assert.match(migration, /when 'resume_import' then 5/i);
  assert.match(migration, /when 'resume_job_match' then 10/i);
  assert.match(migration, /where public\.ai_feature_usage\.used_count < v_limit/i);
  assert.match(migration, /grant execute on function public\.consume_candidate_ai_quota\(text\) to authenticated/i);
  assert.match(migration, /price_minor = 29900/i);
});
