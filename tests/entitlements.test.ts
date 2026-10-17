import test from 'node:test';
import assert from 'node:assert/strict';

import { isSubscriptionPeriodCurrent, planForAudience, PLAN_DEFINITIONS } from '../lib/entitlements.ts';

test('subscription period is current when no fixed end date is supplied', () => {
  assert.equal(isSubscriptionPeriodCurrent(null, 1_800_000_000_000), true);
  assert.equal(isSubscriptionPeriodCurrent(undefined, 1_800_000_000_000), true);
});

test('subscription period expires at or before the current instant', () => {
  const now = Date.parse('2026-10-18T00:00:00.000Z');
  assert.equal(isSubscriptionPeriodCurrent('2026-10-18T00:00:01.000Z', now), true);
  assert.equal(isSubscriptionPeriodCurrent('2026-10-18T00:00:00.000Z', now), false);
  assert.equal(isSubscriptionPeriodCurrent('2026-10-17T23:59:59.000Z', now), false);
});

test('malformed subscription end date fails closed', () => {
  assert.equal(isSubscriptionPeriodCurrent('not-a-date', 1_800_000_000_000), false);
});

test('candidate audience defaults to free plan without a valid paid plan', () => {
  assert.equal(planForAudience('candidate').id, 'candidate_free');
  assert.equal(PLAN_DEFINITIONS.candidate_free.limits.saved_jobs, 10);
});
