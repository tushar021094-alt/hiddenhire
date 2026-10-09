export type GrowthFunnelStep = { eventName: string; events: number; uniqueActors: number };
export type GrowthSource = { source: string; count: number };
export type GrowthExperiment = {
  priority: "high" | "medium" | "low";
  title: string;
  observation: string;
  experiment: string;
  metric: string;
};

const LABELS: Record<string, string> = {
  landing_view: "landing views",
  search_started: "search starts",
  match_results_viewed: "match-result views",
  application_click: "application clicks",
  signup_started: "signup starts",
  signup_completed: "completed signups",
  job_post_started: "job-post starts",
  job_post_completed: "completed job posts",
};

export function recommendGrowthExperiments(input: {
  funnel: GrowthFunnelStep[];
  sources: GrowthSource[];
  totalEvents: number;
}): GrowthExperiment[] {
  const byName = new Map(input.funnel.map((step) => [step.eventName, step.events]));
  const experiments: GrowthExperiment[] = [];
  const landing = byName.get("landing_view") ?? 0;
  const search = byName.get("search_started") ?? 0;
  const results = byName.get("match_results_viewed") ?? 0;
  const clicks = byName.get("application_click") ?? 0;
  const signupStarted = byName.get("signup_started") ?? 0;
  const signupCompleted = byName.get("signup_completed") ?? 0;
  const postStarted = byName.get("job_post_started") ?? 0;
  const postCompleted = byName.get("job_post_completed") ?? 0;

  if (input.totalEvents < 30) {
    experiments.push({
      priority: "low",
      title: "Collect a reliable baseline",
      observation: "There are fewer than 30 events in the selected period, so conversion signals are still sparse.",
      experiment: "Drive a small, consistent set of qualified visits and verify that key events fire once per intended action.",
      metric: "Event coverage and weekly qualified sessions",
    });
  }

  if (landing >= 20 && search / landing < 0.2) {
    experiments.push({
      priority: "high",
      title: "Improve landing-to-search activation",
      observation: `Only ${Math.round((search / landing) * 100)}% as many search-start events as landing views were recorded.`,
      experiment: "Test a clearer primary search CTA and show a sample of matched jobs before asking visitors to register.",
      metric: "Search starts / landing views",
    });
  }

  if (search >= 10 && results / search < 0.5) {
    experiments.push({
      priority: "high",
      title: "Reduce search friction",
      observation: "Search starts are not consistently followed by match-result views.",
      experiment: "Review empty-result states, required filters, loading feedback and search error telemetry.",
      metric: "Match-result views / search starts",
    });
  }

  if (results >= 10 && clicks / results < 0.15) {
    experiments.push({
      priority: "medium",
      title: "Increase qualified application intent",
      observation: "Match-result views are not producing enough application clicks.",
      experiment: "Test more informative match reasons, salary/location visibility and a clearer application action.",
      metric: "Application clicks / match-result views",
    });
  }

  if (signupStarted >= 10 && signupCompleted / signupStarted < 0.6) {
    experiments.push({
      priority: "high",
      title: "Reduce signup abandonment",
      observation: "A substantial share of signup-start events do not have a corresponding completion event.",
      experiment: "Audit OTP delivery, validation errors, mobile form friction and return-to-search behavior.",
      metric: "Completed signups / signup starts",
    });
  }

  if (postStarted >= 5 && postCompleted / postStarted < 0.6) {
    experiments.push({
      priority: "medium",
      title: "Simplify job publishing",
      observation: "Job-post starts are not consistently followed by completed job posts.",
      experiment: "Measure step-level validation failures and test a shorter draft-first posting flow.",
      metric: "Completed job posts / job-post starts",
    });
  }

  if (input.sources.length > 1) {
    const top = [...input.sources].sort((a, b) => b.count - a.count)[0];
    const totalAttributed = input.sources.reduce((sum, item) => sum + item.count, 0);
    if (totalAttributed > 0 && top.count / totalAttributed >= 0.7) {
      experiments.push({
        priority: "low",
        title: "Diversify acquisition testing",
        observation: `${top.source} accounts for ${Math.round((top.count / totalAttributed) * 100)}% of attributed events.`,
        experiment: "Run a small, tagged campaign on one additional relevant channel and compare downstream activation, not just traffic.",
        metric: "Search starts and completed signups by source",
      });
    }
  }

  if (!experiments.length) {
    experiments.push({
      priority: "low",
      title: "Keep monitoring before changing the funnel",
      observation: "The currently recorded signals do not show a strong, measurable bottleneck against the configured thresholds.",
      experiment: "Maintain event instrumentation and compare the same funnel across the next reporting period.",
      metric: "Week-over-week funnel conversion",
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return experiments.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5);
}
