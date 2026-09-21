# HiddenHire Product Specification V1.0

Status: FROZEN
Effective baseline: 2026-09-22
Scope: Candidate marketplace, employer marketplace, recruiter/agency marketplace, monetization, trust, matching, privacy, and V1 technical boundaries.

## 1. Product thesis

HiddenHire is an AI-powered two-sided hiring marketplace, not a low-cost copy of a conventional job board.

Core promise:
- Candidates: "Don't search every day. Let HiddenHire search for you."
- Employers: "Don't screen hundreds of resumes. Let HiddenHire find relevant candidates."

The platform must optimize for relevant discovery, trustworthy jobs, candidate privacy, and hiring productivity.

## 2. User types

1. Candidate
2. Direct Employer
3. Recruitment Agency
4. HiddenHire Admin

Direct employers and agencies are distinct account types. Agency accounts cannot use the direct-employer free plan.

## 3. Candidate plans

### Candidate Free — ₹0
Included:
- Unlimited job browsing
- Unlimited job applications
- Resume/profile
- Basic AI matching
- Basic match explanation
- Saved jobs (limit 10)
- Basic job alerts
- Application tracking
- Standard profile visibility
- External and HiddenHire-native jobs

Hard rule:
- Candidates never pay to apply for a job.
- Free users must be able to use the product meaningfully.

### Candidate Plus — ₹199/month
Positioning: active job seekers who want faster, more personalized discovery.

Included:
- Everything in Free
- Daily personalized AI job feed
- Fresh-job/real-time alerts
- Advanced match explanations
- Unlimited saved jobs
- Advanced filters
- Enhanced application tracking
- Up to 10 AI resume optimizations/month
- Up to 10 AI cover letters/month
- Up to 10 AI interview practice sessions/month
- Salary insights
- Controlled profile visibility boost
- Early notification for strong matches
- Higher notification priority

### Candidate Pro — ₹399/month
Reserved for a later release; do not build as a V1 launch requirement.
Planned direction:
- Higher AI-tool usage
- Advanced interview simulator
- deeper salary/career insights
- additional recruiter-connection credits
- stronger profile tools

The exact Pro quota is not part of the V1 implementation contract.

## 4. Candidate usage and add-ons

The subscription is primarily for discovery and convenience. AI-heavy tools may use quotas.

Future optional add-ons may include:
- AI resume optimization credits
- interview practice credits
- profile boost
- recruiter connection credits

Do not introduce pay-per-application.

## 5. Candidate privacy

Candidate personal contact information is not exposed merely because a recruiter finds a match.

Candidate controls must support:
- profile visibility
- recruiter discovery visibility
- controlled contact/consent
- hide profile from selected employers where technically feasible
- withdrawal of visibility/consent

Recruiter access to candidate contact information must be permissioned and auditable.

## 6. Employer plans

### Employer Free — ₹0
Purpose: acquire legitimate employers and let them experience the marketplace.

Limits:
- 1 active native job at a time
- 1 job credit/month
- 15-day job validity
- unlimited applications to the employer's own job
- full access to its own applicants
- applicant shortlist/status management
- limited AI candidate matching: top 10 matches per job
- basic company profile
- 1 recruiter seat

Not included:
- unrestricted candidate database search
- bulk candidate outreach
- candidate contact unlocks
- featured jobs
- advanced analytics
- advanced screening
- multiple recruiter seats

Free employer must be able to complete a real hiring workflow. Do not intentionally cripple applicant management.

### Employer Starter — ₹1,999/month
Purpose: small businesses/startups hiring regularly.

Included/limits:
- 5 job credits/month
- up to 5 active jobs
- 30-day job validity
- unlimited applications
- AI candidate matching up to 100 candidate matches/month
- candidate database search
- 25 candidate contact unlocks/month
- candidate outreach
- applicant pipeline
- AI shortlist
- company branding
- job analytics
- basic AI screening
- 1 featured/boost action per month
- 1 recruiter seat
- email notifications

### Employer Growth — ₹4,999/month
Purpose: active SME/startup hiring teams.

Included/limits:
- 20 job credits/month
- up to 10 active jobs
- 30-day job validity
- unlimited applications
- up to 500 AI candidate matches/month
- 150 candidate contact unlocks/month
- advanced candidate search
- candidate outreach
- AI shortlist/screening
- 5 recruiter seats
- 5 featured/boost actions/month
- advanced hiring analytics
- company branding
- priority support

### Agency — ₹7,999+/month
Agency is a separate commercial tier.
Initial direction:
- higher job credits
- multiple recruiter seats
- client/job management
- candidate search and outreach
- higher candidate contact allocation
- AI matching
- bulk workflows

Exact agency quotas can be finalized after employer V1 validation; do not silently grant agency accounts employer-free limits.

### Enterprise
Custom pricing. Not a V1 build priority.
Potential features:
- ATS/API integrations
- SSO
- large teams
- advanced permissions
- dedicated support
- custom contracts and usage

## 7. Job credits

Credits are the primary employer consumption unit.

V1 rules:
- Standard native job = 1 credit
- Featured/boosted job = additional consumption according to plan allowance
- Urgent/higher-visibility products are future extensions

Credits must be represented separately from subscription plans in the data model so future products can consume credits without redesigning billing.

Unused monthly plan credits do not automatically roll over unless a later commercial rule explicitly enables rollover.

## 8. Employer candidate access

Critical separation:
- Own applicants: unlimited access within plan and applicable privacy rules.
- HiddenHire candidate pool: plan-controlled access.

Free employers can review limited AI-generated matches but cannot perform unrestricted candidate-database search or bulk outreach.

Candidate contact unlocks are consumed only when the employer requests an allowed contact action; implementation must be auditable and idempotent.

## 9. Job sources

Two job classes:
1. External/aggregated jobs from permitted public/licensed sources.
2. Native HiddenHire jobs posted by employers.

Native HiddenHire jobs are first-class platform listings and may display a Verified Employer indicator.

External source integrations must respect each provider's terms, API limits, licensing, and attribution requirements. Do not scrape sources where prohibited.

## 10. Matching rules

The existing explainable matching engine remains the foundation.

Baseline weighting:
- Job-function relevance: 40%
- Skills: 15%
- Experience: 15%
- Location/remote: 10%
- Salary: 10%
- Seniority: 5%
- Company context: 5%

Important relevance rule:
- A department/role must be represented in the job title or an equivalent structured role classification to qualify as strongly role-relevant.
- Generic mentions in a description must not turn an unrelated department into a strong match.
- Title relevance is weighted materially higher than generic description keyword overlap.

For employer-to-candidate matching, use the same principle in reverse: role/function fit must dominate incidental keyword overlap.

Match explanations must identify positive/negative factors rather than presenting an opaque score.

## 11. Search semantics

- OR within multiple selected states.
- OR within multiple selected cities.
- When both state and city filters exist, state and city constraints are combined.
- Remote-only clears physical-location constraints.
- Workplace Any with no physical location allows remote/hybrid/onsite according to job data.
- When physical location is selected and Workplace Any is used, remote-only jobs are excluded unless Remote-only is selected.
- Salary/CTC matching uses normalized ranges and overlap rather than requiring exact equality.
- Country-aware salary parsing and currency normalization are required.
- City/state aliases are supported.

## 12. Employer verification

Minimum onboarding:
- email verification
- mobile verification
- company identity/details
- recruiter name and designation

Where appropriate:
- company domain/email verification
- company website
- additional business verification

Verification status must be explicit and should not imply government/legal certification unless such verification actually occurred.

## 13. Job moderation

Every native job must pass automated and/or rule-based checks for:
- duplicate jobs
- suspicious/fraudulent patterns
- candidate-fee requests
- MLM/network-marketing patterns
- misleading titles
- salary anomalies
- location anomalies
- discriminatory/illegal requirements where detectable
- spam
- suspicious contact-only recruitment
- department classification
- experience normalization
- salary normalization

High-risk jobs may be held for admin review.

## 14. Candidate/employer trust

Candidate-side:
- clear employer identity where available
- Verified Employer badge
- job freshness
- salary transparency where provided
- report job mechanism

Employer-side:
- candidate profile authenticity signals where available
- application/profile completeness
- controlled contact access
- abuse reporting

Both sides need rate limits and anti-abuse controls.

## 15. Application rules

- Applying remains free for candidates.
- Native HiddenHire applications should be trackable inside HiddenHire.
- External jobs may send the candidate to the external application destination.
- Employers can view and manage applications to their own native jobs.
- Candidate application status is private to the candidate and relevant employer.
- No employer may mass-contact candidates through the candidate database under the Free plan.

## 16. Notifications

Free candidates:
- standard job alerts and essential application notifications.

Plus candidates:
- daily personalized feed
- fresh-job alerts
- high-match alerts
- configurable frequency.

Employers:
- application notifications
- candidate-match notifications within plan quotas
- billing/credit notifications
- moderation/status notifications.

Notification controls and unsubscribe behavior are required.

## 17. Billing principles

Subscriptions:
- monthly recurring plans initially.
- prices are displayed before checkout.
- applicable taxes are added/handled according to the payment provider and jurisdiction.
- usage/credit consumption must be visible to the user.
- plan limits must be enforced server-side, never only in the UI.

Cancellation:
- cancellation stops the next renewal; access continues through the paid period unless payment-provider rules require otherwise.
- no automatic refund promise is made in V1.
- refund policy must be displayed before purchase and implemented consistently.

Failed payment:
- subscription enters a payment-failure state.
- grace/retry behavior is handled by the payment provider.
- premium entitlements are revoked only according to a defined billing state, not client-side assumptions.

Payment provider:
- use a production-grade provider suitable for Indian subscriptions and GST invoicing.
- do not hard-code provider-specific billing logic into matching/search code.

## 18. Entitlement architecture

Plans, quotas, credits, contact unlocks and AI usage must be modeled as server-side entitlements.

Never rely on:
- hidden frontend flags
- client-only counters
- localStorage for paid limits
- UI-only feature hiding

Every paid action must be authorized against current server-side entitlement state.

Usage events should be auditable and idempotent.

## 19. Data model direction

Core entities:
- users
- candidate_profiles
- employer_profiles
- agency_profiles
- companies
- jobs
- job_sources
- applications
- matches
- saved_jobs
- subscriptions
- plans
- entitlements
- credit_ledger
- contact_unlocks
- notifications
- verification_records
- moderation_events
- audit_events
- reports

Future/optional:
- recruiter_seats
- hiring_campaigns
- AI_usage_ledger
- payments/invoices
- recruiter_outreach

Do not couple the matching engine directly to billing tables.

## 20. Admin controls

Admin must eventually be able to:
- suspend employer
- suspend recruiter
- suspend job
- restore job
- mark employer verified/unverified
- review reported jobs
- review suspicious activity
- adjust/credit usage in exceptional cases
- inspect audit history

Admin actions must be logged.

## 21. Anti-abuse rules

Initial protections:
- email/mobile verification
- rate limits
- duplicate job detection
- duplicate account signals
- suspicious outreach detection
- contact-unlock limits
- application spam protection
- report/block mechanisms
- recruiter account suspension
- agency detection where practical

Do not expose candidate bulk-export/database scraping functionality in V1.

## 22. Ranking and paid placement

Paid employers may receive clearly identified promotional/featured placement.

However:
- paid status must not override basic relevance.
- irrelevant jobs must not outrank relevant jobs solely because the employer paid.
- match scores remain based on the matching engine.
- candidate paid status must not fabricate qualifications or guarantee recruiter attention.

The product must maintain candidate trust.

## 23. V1 launch scope

Build first:
1. Candidate account/profile
2. Employer account/company profile
3. Employer verification foundations
4. Native job posting
5. Free employer limits
6. Candidate applications
7. Employer applicant management
8. AI candidate matching
9. Candidate daily/fresh job discovery foundation
10. Subscription/entitlement architecture
11. Candidate Plus entitlement foundation
12. Job moderation foundations
13. Privacy/contact permissions
14. Admin moderation foundation

Build later:
- Candidate Pro
- Agency full suite
- Enterprise
- ATS/API integrations
- advanced interview simulator
- advanced hiring campaigns
- sophisticated paid boosts
- white-label

## 24. Existing HiddenHire source/search baseline

The external discovery engine remains active and should continue using permitted integrations:
- Greenhouse
- Ashby
- Lever
- other sources only when terms/API access permit

The current search-quality improvements and department-role relevance work remain part of the product baseline.

## 25. Non-negotiable product principles

1. Candidate applications are free.
2. Free employers can perform a real but limited hiring workflow.
3. Candidate database access is a paid capability.
4. Candidate personal contact data is not an unrestricted database product.
5. Relevance cannot be completely bought.
6. AI matching must be explainable.
7. Employer verification and job moderation are core trust infrastructure.
8. Paid entitlements are enforced server-side.
9. External job sources must be used lawfully and within provider terms.
10. Do not build features that require a billing/data-model rewrite later when a clean entitlement/credit abstraction can support them.
11. Do not change pricing, limits, privacy rules, matching weights, or core marketplace rules during implementation without explicitly creating V1.1 or later.
12. Any future modification must be evaluated against this specification first.

## 26. V1 freeze procedure

This document is the product baseline.

Before changing a frozen rule:
- identify the affected rule/section
- document the reason
- assess database/API/UI/billing impact
- create a versioned product change
- update tests
- only then implement

No ad-hoc pricing, entitlement, privacy, or marketplace-rule changes should be introduced during feature development.

## 27. Success metrics for initial validation

Track:
- candidate activation
- weekly active candidates
- job applications
- application-to-interview rate where measurable
- employer activation
- free-to-paid employer conversion
- candidate Plus conversion
- job-to-qualified-candidate match rate
- employer shortlist rate
- candidate contact rate
- employer retention
- candidate retention
- fraudulent/reported job rate
- average time from job posting to qualified match

Do not optimize solely for registrations or job-post count.

## 28. Commercial positioning

Candidate:
"Don't search every day. Let HiddenHire search for you."

Employer:
"Don't screen hundreds of resumes. Let HiddenHire find your best matches."

HiddenHire is not positioned as the cheapest job board. Price is an acquisition lever; AI matching, fresh discovery, trust, and hiring productivity are the durable differentiators.
