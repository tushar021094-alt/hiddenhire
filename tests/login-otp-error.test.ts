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


test("login OTP input matches the eight-digit codes currently sent by staging Auth", () => {
  assert.match(loginPage, /8-digit sign-in code/);
  assert.match(loginPage, /label="8-digit code"/);
  assert.ok(loginPage.includes('pattern="[0-9]{8}"'));
  assert.ok(loginPage.includes("slice(0, 8)"));
  assert.ok(loginPage.includes('placeholder="12345678"'));
  assert.ok(loginPage.includes("minLength={8}"));
  assert.ok(loginPage.includes("maxLength={8}"));
  assert.doesNotMatch(loginPage, /6-digit code|placeholder="123456"|slice\(0, 6\)/);
});
