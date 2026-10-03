"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type AccountRole = "candidate" | "employer" | "agency";

const roles = [
  {
    id: "candidate" as const,
    title: "Candidate / Job Seeker",
    description: "Find better opportunities with AI-powered job matching.",
    icon: "◎",
  },
  {
    id: "employer" as const,
    title: "Employer / Company",
    description: "Post jobs and let HiddenHire find qualified candidates.",
    icon: "◆",
  },
  {
    id: "agency" as const,
    title: "Recruiter / Agency",
    description: "Source, match and manage candidates for your clients.",
    icon: "◇",
  },
];

export default function RegisterPage() {
const router = useRouter();
  const [role, setRole] = useState<AccountRole>("candidate");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(event: FormEvent) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        router.push("/dashboard");
        return;
      }

      setMessage(
        "Account created. Check your email to verify your account, then log in."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="hero-glow" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="brand-mark">H</div>
          <div className="text-lg font-bold tracking-tight">HiddenHire</div>
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          Log in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow">
            <span className="pulse-dot" />
            Create your HiddenHire account
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-[-0.045em] sm:text-6xl">
            Your hiring intelligence
            <span className="gradient-text block">starts here.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-white/45 sm:text-base">
            Choose how you use HiddenHire. Your workspace and AI tools will
            adapt to your role.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl">
          <div className="grid gap-4 md:grid-cols-3">
            {roles.map((item) => {
              const selected = role === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    selected
                      ? "border-cyan-300/50 bg-cyan-300/[0.08] shadow-[0_0_40px_rgba(34,211,238,0.08)]"
                      : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                      selected
                        ? "bg-cyan-300/15 text-cyan-200"
                        : "bg-white/[0.06] text-white/60"
                    }`}
                  >
                    {item.icon}
                  </div>

                  <h2 className="text-sm font-semibold text-white">
                    {item.title}
                  </h2>

                  <p className="mt-2 text-xs leading-5 text-white/40">
                    {item.description}
                  </p>

                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    <span
                      className={
                        selected ? "text-cyan-200" : "text-white/25"
                      }
                    >
                      {selected ? "Selected" : "Select"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleRegister}
            className="search-panel mx-auto mt-6 max-w-2xl"
          >
            <div className="panel-top">
              <div>
                <div className="text-sm font-semibold text-white">
                  Create account
                </div>
                <div className="mt-1 text-xs text-white/40">
                  Your account type can determine your HiddenHire workspace.
                </div>
              </div>
            </div>

            <div className="grid gap-5">
              <Field label="Full name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </Field>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 text-sm text-cyan-100">
                {message}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-white/30">
                By continuing, you agree to use HiddenHire responsibly and
                provide accurate account information.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="primary-button whitespace-nowrap"
              >
                {loading ? "Creating account…" : "Create account"}
                <span>→</span>
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-white/35">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-cyan-200 transition hover:text-cyan-100"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}