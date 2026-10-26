import test from 'node:test';
import assert from 'node:assert/strict';

import { mapRazorpaySubscriptionStatus } from '../lib/billing/razorpay.ts';

const allowedStatuses = new Set(['trialing', 'active', 'past_due', 'cancelled', 'expired']);

test('Razorpay webhook states map to subscription statuses accepted by the database', () => {
  const cases: Array<[string, string | null | undefined, string]> = [
    ['subscription.activated', 'active', 'active'],
    ['subscription.resumed', 'resumed', 'active'],
    ['subscription.charged', 'active', 'active'],
    ['subscription.cancelled', 'cancelled', 'cancelled'],
    ['subscription.completed', 'completed', 'expired'],
    ['subscription.expired', 'expired', 'expired'],
    ['subscription.halted', 'halted', 'past_due'],
    ['subscription.paused', 'paused', 'past_due'],
    ['subscription.pending', 'pending', 'past_due'],
    ['subscription.authenticated', 'authenticated', 'past_due'],
    ['unknown.event', 'active', 'past_due'],
    ['unknown.event', 'authenticated', 'past_due'],
    ['unknown.event', 'cancelled', 'cancelled'],
    ['unknown.event', 'completed', 'expired'],
    ['unknown.event', 'expired', 'expired'],
    ['unknown.event', 'halted', 'past_due'],
    ['unknown.event', 'paused', 'past_due'],
    ['unknown.event', 'pending', 'past_due'],
    ['unknown.event', null, 'past_due'],
  ];

  for (const [event, status, expected] of cases) {
    const mapped = mapRazorpaySubscriptionStatus(event, status);
    assert.equal(mapped, expected, event + ':' + String(status));
    assert.equal(allowedStatuses.has(mapped), true, 'status must satisfy subscriptions_status_check');
  }
});
