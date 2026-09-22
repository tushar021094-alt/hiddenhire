import { requireRole } from "@/lib/auth";

export default async function Dashboard(){
  const {profile}=await requireRole(["candidate"]);
  const greeting=profile.full_name ? ", "+profile.full_name : "";
  return <main className="min-h-screen px-5 py-10 sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between"><div><div className="section-kicker">CANDIDATE INTELLIGENCE</div><h1 className="mt-2 text-4xl font-semibold">Your career dashboard</h1><p className="mt-2 text-white/40">Welcome{greeting}.</p></div><a href="/" className="secondary-button">Search jobs</a></div>
    <div className="mt-10 grid gap-4 sm:grid-cols-3"><Stat label="Profile signal" value="Build next"/><Stat label="AI matches" value="Ready"/><Stat label="Saved jobs" value="0"/></div>
    <div className="mt-8 feature-card"><div className="section-kicker">NEXT STEP</div><h2 className="mt-2 text-xl font-semibold">Complete your career profile</h2><p className="mt-2 text-sm text-white/40">Add your target roles, skills, experience and compensation so HiddenHire can match you continuously.</p><a href="/profile" className="secondary-button mt-5 inline-flex">Build profile →</a></div>
  </div></main>
}
function Stat({label,value}:{label:string;value:string}){return <div className="stat-box"><div>{label}</div><strong>{value}</strong></div>}
