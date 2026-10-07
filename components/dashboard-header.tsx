"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  name: string;
  roleLabel: string;
  firstName: string;
};

export default function DashboardHeader({ name, roleLabel, firstName }: Props) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  function submitSearch() {
    const value = query.trim();
    router.push(value ? `/jobs?query=${encodeURIComponent(value)}` : "/jobs");
    setSearchOpen(false);
  }

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="hh-topbar">
      <Link href="/" className="hh-brand" aria-label="HiddenHire home">
        <span className="hh-brand-mark"><i /><i /><i /></span>
        <span>Hidden<span>Hire</span></span>
      </Link>

      <button
        type="button"
        className={`hh-command hh-command-button${searchOpen ? " is-open" : ""}`}
        onClick={() => { setSearchOpen(true); setNotificationsOpen(false); setAccountOpen(false); }}
        aria-label="Search jobs, companies, skills or anything"
      >
        <span className="hh-command-icon">⌕</span>
        <span className="hh-command-label">{query || "Search jobs, companies, skills or anything..."}</span>
        <kbd>⌘ K</kbd>
      </button>

      <div className="hh-top-actions">
        <div className="hh-top-popover-wrap">
          <button
            type="button"
            className={`hh-icon-button${notificationsOpen ? " is-active" : ""}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => { setNotificationsOpen(v => !v); setAccountOpen(false); }}
          >
            ♧<b />
          </button>
          {notificationsOpen && (
            <div className="hh-top-popover hh-notification-popover">
              <div className="hh-popover-heading"><strong>Notifications</strong><span>LIVE</span></div>
              <div className="hh-popover-empty">
                <div>✦</div>
                <strong>You&apos;re all caught up.</strong>
                <p>New opportunity signals and application updates will appear here.</p>
              </div>
            </div>
          )}
        </div>

        <div className="hh-top-popover-wrap">
          <button
            type="button"
            className={`hh-user hh-user-button${accountOpen ? " is-active" : ""}`}
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => { setAccountOpen(v => !v); setNotificationsOpen(false); }}
          >
            <div className="hh-avatar">{firstName.slice(0, 1).toUpperCase()}</div>
            <div className="hh-user-copy"><strong>{name}</strong><span>{roleLabel}</span></div>
            <span className="hh-chevron">⌄</span>
          </button>
          {accountOpen && (
            <div className="hh-top-popover hh-account-popover">
              <div className="hh-account-summary">
                <div className="hh-avatar">{firstName.slice(0, 1).toUpperCase()}</div>
                <div><strong>{name}</strong><span>{roleLabel}</span></div>
              </div>
              <Link href="/profile" onClick={() => setAccountOpen(false)}>Profile</Link>
              <Link href="/applications" onClick={() => setAccountOpen(false)}>Applications</Link>
              <Link href="/dashboard#pricing" onClick={() => setAccountOpen(false)}>HiddenHire Pro</Link>
              <button type="button" className="hh-logout-button" onClick={logout} disabled={loggingOut}>
                {loggingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="hh-command-overlay" role="dialog" aria-modal="true" aria-label="Search HiddenHire">
          <button type="button" className="hh-command-backdrop" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <form className="hh-command-modal" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
            <div className="hh-command-modal-top">
              <span className="hh-command-modal-icon">⌕</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search jobs, companies, skills or anything…"
                aria-label="Search"
              />
              <button type="button" onClick={() => setSearchOpen(false)}>ESC</button>
            </div>
            <div className="hh-command-suggestions">
              <button type="submit"><span>⌕</span><div><strong>Search opportunities</strong><small>Open Job Discovery with your search</small></div><kbd>↵</kbd></button>
              <Link href="/jobs" onClick={() => setSearchOpen(false)}><span>✦</span><div><strong>Browse AI-ranked jobs</strong><small>See your current opportunity stream</small></div><kbd>→</kbd></Link>
              <Link href="/profile" onClick={() => setSearchOpen(false)}><span>♙</span><div><strong>Update career signal</strong><small>Change roles, skills and preferences</small></div><kbd>→</kbd></Link>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
