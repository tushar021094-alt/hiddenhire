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

  useEffect(() => {
    fetch("/api/career-network")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("network")))
      .then((data) => setRelationships(data.relationships ?? []))
      .catch(() => setRelationships([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="hh-card" id="career-network">
      <div className="hh-card-head">
        <div>
          <span className="hh-eyebrow">CAREER NETWORK</span>
          <h2>Relationships worth nurturing</h2>
          <p>HiddenHire turns your application history into relationship signals without exposing private recruiter data.</p>
        </div>
      </div>
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
              <span className="hh-status-pill">{actionLabel[relationship.nextAction]}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
