import Link from "next/link";
import { PLAN_DEFINITIONS } from "@/lib/entitlements";
import { UpgradeButton } from "@/components/upgrade-button";

export default function PricingPage() {
  const candidateFree = PLAN_DEFINITIONS.candidate_free;
  const candidatePlus = PLAN_DEFINITIONS.candidate_plus;
  const checkoutConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_CANDIDATE_PLUS_PLAN_ID);

  return (
    <main className="hh-pricing-page">
      <div className="hh-pricing-shell">
        <header className="hh-pricing-header">
          <Link href="/" className="hh-pricing-brand">Hidden<span>Hire</span></Link>
          <Link href="/dashboard" className="hh-pricing-back">Back to workspace <span>↗</span></Link>
        </header>

        <section className="hh-pricing-hero">
          <span className="hh-pricing-eyebrow">CAREER INTELLIGENCE</span>
          <h1>Choose how deeply HiddenHire works for you.</h1>
          <p>Keep the core matching engine free. Upgrade when you want deeper AI assistance across your career workflow.</p>
        </section>

        <section className="hh-plan-grid">
          <PlanCard
            title="Free"
            price={candidateFree.monthlyPriceInr}
            description="Core discovery and matching for active job seekers."
            features={["AI job matching","Up to 10 saved jobs","Application tracking","1 AI resume optimization / month","1 AI cover letter / month","1 AI interview session / month"]}
          />
          <PlanCard
            title="Candidate Plus"
            price={candidatePlus.monthlyPriceInr}
            description="The full intelligence layer for serious job searches."
            featured
            features={["Everything in Free","10 AI resume optimizations / month","10 AI cover letters / month","10 AI interview sessions / month","Priority Career Agent signals","Deep match intelligence"]}
          />
        </section>

        <section id="checkout" className="hh-pricing-note">
          <div>
            <span>SECURE CHECKOUT</span>
            <h2>Activate Candidate Plus with Razorpay.</h2>
            <p>Your subscription is activated only after HiddenHire receives and verifies the Razorpay webhook. Payment credentials stay server-side; the browser only receives the hosted checkout URL.</p>
          </div>
          <Link href="/dashboard">Return to HiddenHire <span>→</span></Link>
        </section>
      </div>
    </main>
  );
}

function PlanCard({
  title,
  price,
  description,
  features,
  featured = false,
}: {
  title: string;
  price: number;
  description: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <article className={`hh-plan-card ${featured ? "is-pro" : ""}`}>
      {featured && <div className="hh-plan-badge">RECOMMENDED</div>}
      <div className="hh-plan-top">
        <div>
          <span>{title}</span>
          <h2>₹{price.toLocaleString("en-IN")}<small>/month</small></h2>
        </div>
        <div className="hh-plan-orb">{featured ? "✦" : "◎"}</div>
      </div>
      <p className="hh-plan-description">{description}</p>
      <ul>{features.map((feature) => <li key={feature}><b>✓</b>{feature}</li>)}</ul>
      {featured ? (
        <UpgradeButton configured={checkoutConfigured} />
      ) : (
        <Link href="/dashboard" className="hh-plan-button">Continue with Free <span>→</span></Link>
      )}
    </article>
  );
}
