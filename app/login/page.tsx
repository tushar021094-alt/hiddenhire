"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: otpError } = await supabase.auth.signInWithOtp({
  email: email.trim(),
  options: {
    shouldCreateUser: false,
  },
});
      if (otpError) {
        throw otpError;
      }

      setOtpSent(true);
      setMessage("We sent an 8-digit code to your email address.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a sign-in code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });

      if (verifyError) {
        throw verifyError;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code could not be verified.");
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

        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="search-panel mt-10">
          <div className="grid gap-5">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={otpSent}
              />
            </Field>

            {otpSent && <Field label="8-digit code">
  <input
    inputMode="numeric"
    pattern="[0-9]{8}"
    value={otp}
    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
    placeholder="12345678"
    autoComplete="one-time-code"
    required
    minLength={8}
    maxLength={8}
  />
</Field>}
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

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
            {otpSent ? <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setMessage(""); setError(""); }} className="text-sm text-white/45 transition hover:text-white">Use a different email</button> : <span className="text-xs text-white/35">We&apos;ll send a one-time code.</span>}
            <button
              type="submit"
              disabled={loading}
              className="primary-button"
            >
              {loading ? (otpSent ? "Verifying…" : "Sending code…") : (otpSent ? "Verify & sign in" : "Send sign-in code")}
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
