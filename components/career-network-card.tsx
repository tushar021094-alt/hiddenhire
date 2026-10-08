"use client";

import { useEffect, useState } from "react";

type Relationship = {
  key: string;
  companyName: string;
  interactionCount: number;
  strengthScore: number;
  status: "cold" | "active" | "interview_stage" | "reconnect";
  nextAction: "follow_up" | "prepare" | "reconnect" | "watch";
  nextActionDueAt: string | null;
  reasons: string[];
};

const actionLabel = {
  follow_up: "Follow up",
  prepare: "Prepare",
  reconnect: "Reconnect",
  watch: "Watch",
};

export default function CareerNetworkCard() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/career-network")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("network")))
      .then((data) => setRelationships(data.relationships ?? []))
      .catch(() => setRelationships([]))
      .finally(() => setLoading(false));
  }, []);

  async function queueAction(relationship: Relationship) {
    if (relationship.nextAction === "watch") return;
    setWorkingKey(relationship.key);
    setMessage("");
    try {
      const response = await fetch("/api/career-network/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipKey: relationship.key,
          companyName: relationship.companyName,
          action: relationship.nextAction,
          summary: relationship.reasons.join(" "),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to queue action.");
      setMessage(data.deduplicated ? "Action already queued in Execution Control." : "Action queued for approval in Execution Control.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue action.");
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <section className="hh-card" id="career-network">
      <div className="hh-card-head">
        <div>
          <span className="hh-eyebrow">CAREER NETWORK</span>
          <h2>Relationships worth nurturing</h2>
          <p>HiddenHire turns your application history into relationship signals without exposing private recruiter data.</p>
        </div>
      </div>
      {message ? <div className="hh-muted">{message}</div> : null}
      {loading ? <div className="hh-muted">Building your relationship graph…</div> : relationships.length === 0 ? (
        <div className="hh-muted">Your network will appear as you interact with recruiters and companies.</div>
      ) : (
        <div className="hh-stack">
          {relationships.slice(0, 6).map((relationship) => (
            <article key={relationship.key} className="hh-operation-item">
              <div>
                <strong>{relationship.companyName}</strong>
                <div className="hh-muted">{relationship.interactionCount} interaction{relationship.interactionCount === 1 ? "" : "s"} · {relationship.strengthScore}% relationship signal</div>
                <p>{relationship.reasons[1]}</p>
              </div>
              <div className="hh-stack" style={{ alignItems: "flex-end", gap: 8 }}>
                <span className="hh-status-pill">{actionLabel[relationship.nextAction]}</span>
                {relationship.nextAction !== "watch" ? (
                  <button
                    type="button"
                    className="hh-button"
                    onClick={() => queueAction(relationship)}
                    disabled={workingKey === relationship.key}
                  >
                    {workingKey === relationship.key ? "Queueing…" : "Queue action"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
