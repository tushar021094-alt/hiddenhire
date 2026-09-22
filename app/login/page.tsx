"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
 const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        throw loginError;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
          href="/register"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65 transition hover:bg-white/[0.08] hover:text-white"
        >
          Create account
        </Link>
      </nav>

      <section className="relative z-10 mx-auto max-w-xl px-5 pb-20 pt-14 sm:px-8 sm:pt-24">
        <div className="text-center">
          <div className="eyebrow">
            <span className="pulse-dot" />
            Welcome back
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
            Continue with
            <span className="gradient-text block">HiddenHire.</span>
          </h1>

          <p className="mt-5 text-sm leading-6 text-white/45">
            Sign in to access your AI-powered hiring workspace.
          </p>
        </div>

        <form onSubmit={handleLogin} className="search-panel mt-10">
          <div className="grid gap-5">
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
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-white/[0.07] pt-5">
            <button
              type="submit"
              disabled={loading}
              className="primary-button"
            >
              {loading ? "Signing in…" : "Sign in"}
              <span>→</span>
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-white/35">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-cyan-200 transition hover:text-cyan-100"
          >
            Create one
          </Link>
        </p>
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