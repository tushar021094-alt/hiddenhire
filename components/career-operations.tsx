"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CareerOperation } from "@/lib/career-operations";

type Props = { refreshKey?: number };

const priorityClass: Record<CareerOperation["priority"], string> = {
  urgent: "hh-operation-priority is-urgent",
  high: "hh-operation-priority is-high",
  medium: "hh-operation-priority is-medium",
  low: "hh-operation-priority is-low",
};

export default function CareerOperations({ refreshKey = 0 }: Props) {
  const [operations, setOperations] = useState<CareerOperation[]>([]);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/career-operations");
      const data = await response.json();
      if (response.ok) {
        setOperations(Array.isArray(data.operations) ? data.operations : []);
        setReadiness(typeof data.readiness === "number" ? data.readiness : null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [refreshKey]);

  const urgent = operations.filter((item) => item.priority === "urgent").length;
  const approvals = operations.filter((item) => item.requiresApproval).length;

  return (
    <section className="hh-panel hh-operations-panel" id="operations">
      <div className="hh-panel-heading">
        <div>
          <small>CAREER OPERATIONS · PHASE 20</small>
          <h2>What needs to happen next</h2>
        </div>
        <span className="hh-operations-status">{loading ? "SYNCING" : "AUTOMATED"}</span>
      </div>

      <div className="hh-operations-summary">
        <div><strong>{urgent}</strong><span>urgent</span></div>
        <div><strong>{operations.length}</strong><span>open operations</span></div>
        <div><strong>{approvals}</strong><span>need approval</span></div>
        {readiness !== null && <div><strong>{readiness}%</strong><span>profile signal</span></div>}
      </div>

      {loading ? (
        <div className="hh-operations-empty">Building your execution queue…</div>
      ) : operations.length === 0 ? (
        <div className="hh-operations-empty">
          <strong>Your career pipeline is clear.</strong>
          <span>HiddenHire will surface the next operation when a new opportunity, application update or follow-up becomes actionable.</span>
        </div>
      ) : (
        <div className="hh-operations-list">
          {operations.map((operation) => (
            <article key={operation.id} className="hh-operation-row">
              <div className="hh-operation-icon">
                {operation.kind === "interview_prepare" ? "◎" : operation.kind === "application_follow_up" ? "↗" : operation.kind === "profile_improvement" ? "✦" : "→"}
              </div>
              <div className="hh-operation-main">
                <div className="hh-operation-topline">
                  <strong>{operation.title}</strong>
                  <span className={priorityClass[operation.priority]}>{operation.priority}</span>
                </div>
                <p>{operation.summary}</p>
                <small>{operation.reason}{operation.requiresApproval ? " · Your approval is required before communication or submission." : ""}</small>
              </div>
              <div className="hh-operation-action">
                {operation.route === "/profile" ? (
                  <Link href="/profile">Improve →</Link>
                ) : operation.route === "/applications" ? (
                  <Link href="/applications">{operation.requiresApproval ? "Open →" : "Prepare →"}</Link>
                ) : (
                  <Link href="/jobs">Review →</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="hh-operations-footer">
        <span>HiddenHire executes discovery, prioritization and preparation automatically.</span>
        <span>Applications and messages remain approval-gated.</span>
      </div>
    </section>
  );
}
