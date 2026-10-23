export type DiscoveryView = "for-you" | "recent" | "remote" | "high-salary";

export type DiscoveryViewJob = {
  remote?: boolean | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  postedDate?: string | null;
  score?: number | null;
  currency?: string | null;
  salaryCurrency?: string | null;
};

function currencyOf(job: DiscoveryViewJob): string {
  return String(job.currency || job.salaryCurrency || "").trim().toUpperCase();
}

function disclosedSalary(job: DiscoveryViewJob): number {
  const max = typeof job.salaryMax === "number" ? job.salaryMax : 0;
  const min = typeof job.salaryMin === "number" ? job.salaryMin : 0;
  return Math.max(max, min, 0);
}

/**
 * These four views are mutually exclusive presets over the currently loaded
 * eligible inventory. Work-mode chips above Job Discovery remain independent
 * search filters; switching a view never fires a competing request.
 */
export function getVisibleDiscoveryJobs<T extends DiscoveryViewJob>(
  jobs: readonly T[],
  view: DiscoveryView,
  preferredCurrency = "INR",
): T[] {
  let visible = [...jobs];

  if (view === "remote") {
    visible = visible.filter((job) => job.remote === true);
  }

  if (view === "high-salary") {
    // Undisclosed salaries must not be shown as "high salary" recommendations.
    visible = visible.filter((job) => disclosedSalary(job) > 0);
    visible.sort((a, b) => {
      const aCurrency = currencyOf(a);
      const bCurrency = currencyOf(b);
      const preferred = preferredCurrency.toUpperCase();
      const aPreferred = aCurrency === preferred ? 1 : 0;
      const bPreferred = bCurrency === preferred ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      // Group differing currencies instead of implying their nominal figures
      // are directly comparable. Within each currency, highest salary comes first.
      if (aCurrency !== bCurrency) return aCurrency.localeCompare(bCurrency);
      return disclosedSalary(b) - disclosedSalary(a);
    });
    return visible;
  }

  if (view === "recent") {
    visible.sort((a, b) => {
      const aParsed = a.postedDate ? Date.parse(a.postedDate) : 0;
      const bParsed = b.postedDate ? Date.parse(b.postedDate) : 0;
      const aDate = Number.isFinite(aParsed) ? aParsed : 0;
      const bDate = Number.isFinite(bParsed) ? bParsed : 0;
      return bDate - aDate;
    });
    return visible;
  }

  visible.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return visible;
}

export function getDiscoveryViewEmptyMessage(view: DiscoveryView): string {
  if (view === "remote") {
    return "No remote roles are available in the current result set. Try For You or Recent, or adjust the Work Mode filters above.";
  }
  if (view === "high-salary") {
    return "No roles in the current result set disclose salary, so HiddenHire cannot rank them by salary yet. Try For You or Recent, or revisit when salary details are available.";
  }
  return "No opportunities are available in this view yet. Try For You to return to profile-ranked roles.";
}
