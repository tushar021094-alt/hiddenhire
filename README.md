# HiddenHire

HiddenHire is an AI-powered job discovery platform built to help candidates discover highly relevant roles, especially remote international jobs that explicitly hire from India.

## What HiddenHire does

HiddenHire answers a simple problem: candidates waste time applying to jobs that are a weak fit. The platform lets a user share a profile, set target preferences, and immediately see the best matches backed by a transparent score and clear reasons.

## V1 features

- Professional landing page with startup-quality branding and product messaging
- Candidate profile form for resume summary, target job title, experience, salary, countries, remote preference, industries, and skills
- Deterministic weighted matching engine with explainable results and missing requirements
- Seed job dataset with realistic example roles and clear demo labeling
- Job results cards with match percentage, location, India eligibility, salary, reasons, missing gaps, and apply links
- Filters for remote-only, India eligible, minimum salary, job type, and industry
- Saved, applied, and rejected tracking using localStorage
- OpenAI-ready server-side API route that falls back safely when no API key is configured
- Job source abstraction with a SeedJobSource implementation ready for future legitimate APIs and feeds

## Tech stack

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI SDK
- Local demo data with a pluggable source architecture

## Local installation

1. Clone the repository.
2. Install dependencies:
   npm install
3. Copy the environment template:
   cp .env.example .env.local
4. Update environment variables if needed.
5. Start the app:
   npm run dev

## Environment variables

Create a .env.local file with:

- OPENAI_API_KEY=
- OPENAI_MODEL=gpt-4o-mini
- NEXT_PUBLIC_APP_URL=http://localhost:3000

The app continues to work without OPENAI_API_KEY because the deterministic matching engine remains active as the default path.

## Development command

npm run dev

## Production build command

npm run build

## Future job-source architecture

The project is structured around a JobSource interface so future sources can be added without rewriting the match engine or job UX. The V1 implementation includes SeedJobSource, and future additions can include GreenhouseJobSource, LeverJobSource, and other legitimate provider integrations.

## Product goal

Stop searching. Start finding.

HiddenHire focuses on the core value of high-match discovery and direct application flow without building unsupported features such as scraping, auto-apply, subscriptions, or complex authentication.
