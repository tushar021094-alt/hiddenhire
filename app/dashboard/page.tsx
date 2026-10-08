import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CareerAgent from "@/components/career-agent";
import CareerOperations from "@/components/career-operations";
import CareerExecution from "@/components/career-execution";
import CareerAgentExecution from "@/components/career-agent-execution";
import JobWatchManager from "@/components/job-watch-manager";
import DashboardHeader from "@/components/dashboard-header";
import TimeAwareGreeting from "@/components/time-aware-greeting";
import RecruiterSlaCard from "@/components/recruiter-sla-card";
import RecruiterQualityCard from "@/components/recruiter-quality-card";
import { calculateRecruiterSla } from "@/lib/recruiter-sla";
import MarketplaceSafetyCard from "@/components/marketplace-safety-card";
import ModerationQueueCard from "@/components/moderation-queue-card";

type Profile = {
  full_name: string | null;
  role: "candidate" | "employer" | "agency" | "admin";
  location: string | null;
  skills: string[] | null;
  experience_years: number | null;
  min_salary: number | null;
  remote_only: boolean;
};

const roleCopy = {
  candidate: {
    eyebrow: "Candidate Intelligence",
    title: "Your career, continuously matched.",
    subtitle: "HiddenHire turns your profile into a live opportunity signal and surfaces roles worth your attention.",
    primary: "Complete your profile",
    secondary: "Explore matched jobs",
    cards: [
      ["Match Radar", "AI-ranked opportunities based on role, skills, experience, location and compensation."],
      ["Career Signal", "See where your profile is strongest and where targeted skill improvements can increase fit."],
      ["Application Control", "Track applications, saved jobs and recruiter activity from one workspace."],
    ],
  },
  employer: {
    eyebrow: "Employer Intelligence",
    title: "Find the people who actually fit.",
    subtitle: "Post roles, let HiddenHire understand the job, and build a qualified shortlist without screening hundreds of profiles manually.",
    primary: "Post a job",
    secondary: "Open applicant pipeline",
    cards: [
      ["Candidate Match Radar", "AI-ranked candidates with explainable fit across function, skills, experience, location and salary."],
      ["AI Shortlist", "Turn a large applicant pool into a focused shortlist with consistent matching logic."],
      ["Hiring Funnel", "Track open roles, applications, matches and next actions from one employer workspace."],
    ],
  },
  agency: {
    eyebrow: "Recruiter Intelligence",
    title: "Your recruiting desk, powered by AI.",
    subtitle: "Search, match and manage candidates across client roles with a workflow designed for recruitment agencies.",
    primary: "Create a recruiter job",
    secondary: "Open candidate search",
    cards: [
      ["Multi-role Matching", "Match your candidate pool against multiple client requirements and surface the strongest fits."],
      ["AI Shortlists", "Generate explainable shortlists instead of manually reviewing every profile."],
      ["Recruiter Workflow", "Keep jobs, candidates, outreach and hiring progress in one workspace."],
    ],
  },
  admin: {
    eyebrow: "Platform Operations",
    title: "HiddenHire control centre.",
    subtitle: "Monitor platform activity, verification, moderation and marketplace health.",
    primary: "Review activity",
    secondary: "Open moderation",
    cards: [
      ["Verification", "Review employer and recruiter verification states."],
      ["Moderation", "Surface suspicious, duplicate or policy-sensitive marketplace activity."],
      ["Platform Health", "Monitor jobs, applications, matches and operational signals."],
    ],
  },
} as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, location, skills, experience_years, min_salary, remote_only")
    .eq("id", user.id)
    .maybeSingle();

  const { data: candidateProfile } = profile?.role === "candidate"
    ? await supabase
        .from("candidate_profiles")
        .select("target_roles, preferred_locations")
        .eq("profile_id", user.id)
        .maybeSingle()
    : { data: null };
      const isRecruiter = profile?.role === "employer" || profile?.role === "agency";

  const { data: recruiterJobs } = isRecruiter
    ? await supabase
        .from("jobs")
        .select(
          "id, title, city, region, remote, status, created_at"
        )
        .eq("posted_by", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };
      const recruiterJobList = Array.isArray(recruiterJobs) ? recruiterJobs : [];
  const { data: recruiterApplications } = isRecruiter
    ? await supabase
        .from("applications")
        .select("id, job_id, status, created_at, candidate_reminder_count, last_candidate_reminder_at, recruiter_response_due_at, recruiter_first_response_at, recruiter_response_count")
        .in("job_id", recruiterJobList.map((job) => job.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const recruiterSla = isRecruiter
    ? calculateRecruiterSla((Array.isArray(recruiterApplications) ? recruiterApplications : []).map((application) => ({
        id: application.id,
        status: application.status,
        createdAt: application.created_at,
        candidateReminderCount: application.candidate_reminder_count,
        lastCandidateReminderAt: application.last_candidate_reminder_at,
        responseDueAt: application.recruiter_response_due_at,
        recruiterFirstResponseAt: application.recruiter_first_response_at,
        recruiterResponseCount: application.recruiter_response_count,
      })))
    : null;

  const { data: recruiterQualityRow } = isRecruiter
    ? await supabase
        .from("recruiter_quality")
        .select("recruiter_id, total_applications, response_rate, overdue_applications, reminded_applications, median_first_response_hours, responsiveness_score, trust_tier, repeated_non_response, identity_verified, company_verified, trust_score")
        .eq("recruiter_id", user.id)
        .maybeSingle()
    : { data: null };
  const { data: recruiterSafetyRows } = isRecruiter && recruiterJobList.length
    ? await supabase
        .from("job_safety_risk")
        .select("job_id, tier, action")
        .in("job_id", recruiterJobList.map((job) => job.id))
    : { data: [] };
  const recruiterSafetyList = Array.isArray(recruiterSafetyRows) ? recruiterSafetyRows : [];
  const { data: moderationCases } = isRecruiter
    ? await supabase
        .from("moderation_cases")
        .select("queue, decision, status")
        .in("job_id", recruiterJobList.map((job) => job.id))
    : { data: [] };
  const moderationCaseList = Array.isArray(moderationCases) ? moderationCases : [];
  const moderationMetrics = isRecruiter ? {
    total: moderationCaseList.length,
    urgent: moderationCaseList.filter((row) => row.queue === "urgent" && row.status !== "resolved").length,
    review: moderationCaseList.filter((row) => row.queue === "review" && row.status !== "resolved").length,
    monitor: moderationCaseList.filter((row) => row.queue === "monitor" && row.status !== "resolved").length,
    restricted: moderationCaseList.filter((row) => row.decision === "restrict" || row.decision === "escalate").length,
  } : null;

  const marketplaceSafety = isRecruiter ? {
    totalJobs: recruiterJobList.length,
    guardedJobs: recruiterSafetyList.filter((row) => row.tier === "guarded").length,
    highRiskJobs: recruiterSafetyList.filter((row) => row.tier === "high").length,
    criticalJobs: recruiterSafetyList.filter((row) => row.tier === "critical").length,
    escalations: recruiterSafetyList.filter((row) => row.action === "escalate").length,
  } : null;

  const recruiterQuality = recruiterQualityRow ? {
    recruiterId: recruiterQualityRow.recruiter_id,
    totalApplications: recruiterQualityRow.total_applications,
    responseRate: recruiterQualityRow.response_rate,
    overdueApplications: recruiterQualityRow.overdue_applications,
    remindedApplications: recruiterQualityRow.reminded_applications,
    medianFirstResponseHours: recruiterQualityRow.median_first_response_hours == null ? null : Number(recruiterQualityRow.median_first_response_hours),
    responsivenessScore: recruiterQualityRow.responsiveness_score,
    trustTier: recruiterQualityRow.trust_tier as "new" | "trusted" | "established" | "building" | "needs_attention",
    repeatedNonResponse: recruiterQualityRow.repeated_non_response,
    identityVerified: recruiterQualityRow.identity_verified,
    companyVerified: recruiterQualityRow.company_verified,
    trustScore: recruiterQualityRow.trust_score,
  } : null;

  const recruiterJobCount = recruiterJobList.length;
  const recruiterPendingCount = recruiterJobList.filter(
    (job) => job.status === "pending_review"
  ).length;
  const recruiterPublishedCount = recruiterJobList.filter(
    (job) => job.status === "published"
  ).length;

  const role = (profile?.role ?? "candidate") as keyof typeof roleCopy;
  const copy = roleCopy[role] ?? roleCopy.candidate;
  const name = profile?.full_name || user.email?.split("@")[0] || "there";
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const { data: candidateApplications, count: applicationCount } = role === "candidate"
    ? await supabase
        .from("applications")
        .select("id, status, created_at, updated_at, jobs(title, companies(name))", { count: "exact" })
        .eq("candidate_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [], count: 0 };
  const profileSignals = [
    Boolean(profile?.full_name),
    Boolean(profile?.location),
    skills.length > 0,
    typeof profile?.experience_years === "number" && profile.experience_years > 0,
  ];
  const profileReadiness = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);
  const applicationList = Array.isArray(candidateApplications) ? candidateApplications : [];
  const interviewCount = applicationList.filter((application) => application.status === "interview").length;
  const activeApplicationCount = applicationList.filter((application) => ["applied", "reviewing", "shortlisted", "interview"].includes(application.status)).length;
  const firstName = name.split(" ")[0];


  return (
    <main className="hh-dashboard">
      <div className="hh-shell">
        <DashboardHeader
          name={name}
          firstName={firstName}
          roleLabel={role === "candidate" ? "Job Seeker" : role === "agency" ? "Recruiter" : role === "employer" ? "Employer" : "Admin"}
        />

        <div className="hh-layout">
          <aside className="hh-sidebar">
            <nav aria-label="Dashboard navigation">
              {role === "candidate" ? <>
                <Link href="/dashboard" className="hh-nav-item is-active"><span>⌂</span>Dashboard</Link>
                <Link href="/jobs" className="hh-nav-item"><span>⌘</span>Job Discovery</Link>
                <Link href="/dashboard#career-agent" className="hh-nav-item"><span>✦</span>Career Agent <em>AI</em></Link>
                <Link href="/dashboard#operations" className="hh-nav-item"><span>⚡</span>Career Operations</Link>
                <Link href="/dashboard#execution" className="hh-nav-item"><span>↗</span>Career Execution <em>AI</em></Link>
                <Link href="/applications" className="hh-nav-item"><span>▤</span>Applications</Link>
                <Link href="/jobs" className="hh-nav-item"><span>♡</span>Saved Jobs</Link>
                <Link href="/profile" className="hh-nav-item"><span>♙</span>Profile</Link>
              </> : <Link href="/dashboard" className="hh-nav-item is-active"><span>⌂</span>Workspace</Link>}
              <Link href="/dashboard#insights" className="hh-nav-item"><span>◫</span>Insights</Link>
              <Link href="/dashboard#learning" className="hh-nav-item"><span>◇</span>Learning</Link>
            </nav>

            {isRecruiter && <div className="hh-side-section">
              <small>FOR RECRUITERS</small>
              <Link href="/recruiter" className="hh-nav-item"><span>⚑</span>Post a Job</Link>
              <Link href="/recruiter" className="hh-nav-item"><span>♙</span>Find Talent</Link>
              <Link href="/recruiter" className="hh-nav-item"><span>▦</span>Recruiter Dashboard</Link>
            </div>}

            {role === "candidate" && <div className="hh-pro-card">
              <div className="hh-pro-orb">✦</div><strong>Upgrade to Pro</strong>
              <p>Unlock advanced AI insights, priority opportunities and deeper career intelligence.</p>
              <Link href="/pricing">Explore Pro <span>→</span></Link>
            </div>}
            <div className="hh-help"><span>◉</span><div><strong>Need help?</strong><small>Career guidance is here.</small></div></div>
          </aside>

          <section className="hh-content">
            <div className="hh-hero">
              <div className="hh-hero-art" aria-hidden="true"><div className="hh-stars" /><div className="hh-planet" /><div className="hh-city"><i /><i /><i /><i /><i /></div></div>
              <div className="hh-hero-copy">
                <p className="hh-eyebrow">{copy.eyebrow} <span className="hh-live-dot" /> LIVE</p>
                <h1><TimeAwareGreeting firstName={firstName} /><br /><span>Your next opportunity is closer than you think.</span></h1>
                <p>{copy.subtitle}</p>
                <div className="hh-hero-pills"><span>✦ AI-powered matching</span><span>◎ Global opportunities</span><span>◈ Personalized insights</span></div>
              </div>
              <div className="hh-agent-card">
                <div className="hh-agent-icon">✦</div>
                <div className="hh-agent-title"><strong>{role === "candidate" ? "Your AI Career Agent" : copy.eyebrow}</strong><span>{role === "candidate" ? "ONLINE" : "READY"}</span></div>
                <p>{role === "candidate" ? "Continuously analyzing opportunities and your career signal." : copy.subtitle}</p>
                <ul><li><b>✓</b> Profile signal analyzed</li><li><b>✓</b> Matching preferences loaded</li><li><b>•</b> Finding your best opportunities</li></ul>
                <Link href={role === "candidate" ? "/jobs" : isRecruiter ? "/recruiter" : "/dashboard"}>{role === "candidate" ? "View matched jobs" : copy.primary} <span>→</span></Link>
              </div>
            </div>

            {role === "candidate" ? <>
              <div className="hh-stat-grid">
                <article className="hh-stat-card stat-violet"><span className="hh-stat-icon">◎</span><div><small>Applications</small><strong>{applicationCount ?? 0}</strong><em>{activeApplicationCount} active</em></div><i className="hh-sparkline" /></article>
                <article className="hh-stat-card stat-blue"><span className="hh-stat-icon">▤</span><div><small>Interviews</small><strong>{interviewCount}</strong><em>Tracked in your pipeline</em></div><i className="hh-sparkline" /></article>
                <article className="hh-stat-card stat-pink"><span className="hh-stat-icon">✦</span><div><small>Profile strength</small><strong>{profileReadiness}%</strong><em>{profileReadiness < 100 ? "Room to improve" : "Profile ready"}</em></div><i className="hh-sparkline" /></article>
                <article className="hh-stat-card stat-gold"><span className="hh-stat-icon">◉</span><div><small>Skills tracked</small><strong>{skills.length}</strong><em>{skills.length ? "Matching signal active" : "Add skills to improve"}</em></div><i className="hh-sparkline" /></article>
              </div>

              <div className="hh-main-grid">
                <section className="hh-panel hh-jobs-panel">
                  <div className="hh-panel-heading"><div><small>OPPORTUNITY STREAM</small><h2>Top matches for you</h2></div><Link href="/jobs">View all <span>→</span></Link></div>
                  <div className="hh-tabs"><span className="is-active">For You</span><span>Recent</span><span>Remote</span><span>High Salary</span></div>
                  <div className="hh-job-list">
                    {applicationList.length > 0 ? applicationList.slice(0, 4).map((application) => {
                      const job = (Array.isArray(application.jobs) ? application.jobs[0] : application.jobs) as { title?: string; companies?: { name?: string } | { name?: string }[] } | null;
                      const company = Array.isArray(job?.companies) ? job.companies[0] : job?.companies;
                      return <article key={application.id} className="hh-job-row">
                        <div className="hh-company-mark">{(company?.name || "H").slice(0, 1).toUpperCase()}</div>
                        <div className="hh-job-info"><strong>{job?.title || "Application"}</strong><span>{company?.name || "HiddenHire opportunity"} · {application.status.replace("_", " ")}</span><div><i>Tracked</i><i>{new Date(application.created_at).toLocaleDateString()}</i></div></div>
                        <span className="hh-match-badge">Active</span><Link href="/applications" className="hh-job-action">Open</Link>
                      </article>;
                    }) : <div className="hh-empty-job"><div className="hh-empty-icon">✦</div><div><strong>Your opportunity stream is ready.</strong><p>Complete your profile and discover roles ranked around your real career signal.</p></div><Link href="/jobs" className="hh-job-action">Discover jobs</Link></div>}
                  </div>
                </section>

                <aside className="hh-right-stack">
                  <section className="hh-panel hh-plan-card">
                    <div className="hh-panel-heading"><div><small>CAREER AGENT</small><h2>Today&apos;s plan</h2></div><span>LIVE</span></div>
                    <div className="hh-plan-item"><b>✦</b><div><strong>Review your highest matches</strong><small>Let the agent prioritize what deserves attention.</small></div><span>›</span></div>
                    <div className="hh-plan-item"><b>✓</b><div><strong>Keep applications moving</strong><small>Track responses and prepare next steps.</small></div><span>›</span></div>
                    <div className="hh-plan-item"><b>↗</b><div><strong>{profileReadiness < 100 ? "Strengthen your profile" : "Review your career signal"}</strong><small>{profileReadiness < 100 ? "Small improvements can increase match quality." : "Your profile is ready for active discovery."}</small></div><span>›</span></div>
                  </section>

                  <section className="hh-panel hh-profile-card">
                    <div className="hh-panel-heading"><div><small>PROFILE SIGNAL</small><h2>Career readiness</h2></div></div>
                    <div className="hh-ring" style={{"--readiness": profileReadiness + "%"} as React.CSSProperties}><span>{profileReadiness}%</span></div>
                    <p>{profileReadiness < 100 ? "Complete the remaining profile signals to improve matching precision." : "Your core profile signals are complete."}</p>
                    <Link href="/profile">Improve profile <span>→</span></Link>
                  </section>
                </aside>
              </div>

              <CareerOperations />
              <CareerExecution />
                <CareerAgentExecution />
              <div id="career-agent" className="hh-agent-section"><CareerAgent targetRoles={Array.isArray(candidateProfile?.target_roles) ? candidateProfile.target_roles : []} preferredLocations={Array.isArray(candidateProfile?.preferred_locations) ? candidateProfile.preferred_locations : []} location={profile?.location ?? null} skills={skills} yearsOfExperience={Number(profile?.experience_years ?? 0)} minimumSalary={Number(profile?.min_salary ?? 0)} remoteOnly={Boolean(profile?.remote_only)} applications={applicationList} /></div>
              <section id="pricing" className="hh-pricing-section">
                <div className="hh-pricing-heading">
                  <div>
                    <small>HIDDENHIRE PRO</small>
                    <h2>Go deeper with career intelligence.</h2>
                    <p>Unlock deeper opportunity signals, advanced matching insights and priority career intelligence from one monthly plan.</p>
                  </div>
                  <span className="hh-pricing-cycle">MONTHLY</span>
                </div>
                <div className="hh-pricing-grid">
                  <article className="hh-plan-option hh-plan-free">
                    <div><small>CURRENT PLAN</small><h3>Free</h3><p>Core job discovery and your existing career workspace.</p></div>
                    <strong>₹0 <span>/ month</span></strong>
                  </article>
                  <article className="hh-plan-option hh-plan-pro">
                    <div>
                      <small>RECOMMENDED</small>
                      <h3>Pro</h3>
                      <p>Advanced AI insights, priority opportunities and deeper career intelligence.</p>
                      <ul><li>Advanced match intelligence</li><li>Priority opportunity signals</li><li>Deeper career insights</li></ul>
                    </div>
                    <div className="hh-plan-price"><strong>₹199</strong><span>/ month</span><a href="#pricing">Upgrade to Pro <span>→</span></a></div>
                  </article>
                </div>
              </section>

              <div id="learning" className="hh-watch-section"><JobWatchManager targetRoles={Array.isArray(candidateProfile?.target_roles) ? candidateProfile.target_roles : []} preferredLocations={Array.isArray(candidateProfile?.preferred_locations) ? candidateProfile.preferred_locations : []} skills={skills} minimumSalary={Number(profile?.min_salary ?? 0)} currency="INR" remoteOnly={Boolean(profile?.remote_only)} /></div>
            </> : (
              <section className="hh-recruiter-workspace">
                {recruiterSla && <RecruiterSlaCard metrics={recruiterSla} />}
                {recruiterQuality && <RecruiterQualityCard quality={recruiterQuality} />}
                {marketplaceSafety && <MarketplaceSafetyCard metrics={marketplaceSafety} />}
                {moderationMetrics && <ModerationQueueCard metrics={moderationMetrics} />}
                <div className="hh-stat-grid">
                  <article className="hh-stat-card stat-violet"><span className="hh-stat-icon">▦</span><div><small>Total jobs</small><strong>{recruiterJobCount}</strong><em>Created by your account</em></div></article>
                  <article className="hh-stat-card stat-blue"><span className="hh-stat-icon">◷</span><div><small>Pending review</small><strong>{recruiterPendingCount}</strong><em>Awaiting approval</em></div></article>
                  <article className="hh-stat-card stat-pink"><span className="hh-stat-icon">✓</span><div><small>Published</small><strong>{recruiterPublishedCount}</strong><em>Live on HiddenHire</em></div></article>
                </div>
                <section className="hh-panel hh-recruiter-list">
                  <div className="hh-panel-heading"><div><small>RECRUITER WORKSPACE</small><h2>Your jobs</h2></div><Link href="/recruiter">Post a job <span>→</span></Link></div>
                  {recruiterJobList.length === 0 ? <div className="hh-empty-job"><div className="hh-empty-icon">✦</div><div><strong>No jobs created yet.</strong><p>Create your first role and let HiddenHire build the matching pipeline.</p></div><Link href="/recruiter" className="hh-job-action">Post a job</Link></div> : recruiterJobList.map((job) => <div key={job.id} className="hh-recruiter-row"><div><strong>{job.title}</strong><span>{job.city || job.region || "India"}{job.remote ? " · Remote" : ""}</span></div><span className="hh-status-pill">{job.status.replace("_", " ")}</span><Link href={"/recruiter/jobs/" + job.id}>Manage →</Link></div>)}
                </section>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}