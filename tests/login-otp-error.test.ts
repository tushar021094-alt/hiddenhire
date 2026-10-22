import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loginPage = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("OTP sign-in does not create accounts implicitly", () => {
  assert.match(loginPage, /shouldCreateUser:\s*false/);
});

test("OTP sign-in response gives useful account-creation guidance instead of raw Supabase wording", () => {
  assert.match(loginPage, /signups not allowed for otp/i);
  assert.match(loginPage, /If you are new to this Preview, select Create account first/);
  assert.doesNotMatch(loginPage, /setError\(err instanceof Error \? err\.message : "Could not send a sign-in code\."\)/);
  assert.match(loginPage, /href="\/register"/);
});


test("OTP sign-in explicitly redirects to the current app origin callback", () => {
  assert.match(loginPage, /emailRedirectTo:\s*`\$\{window\.location\.origin\}\/auth\/callback`/);
});
