"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  action: string;
  state: string;
  title: string;
  summary: string;
  requires_approval: boolean;
  attempts: number;
};

const taskTemplates = [
  { action: "prepare", title: "Prepare application materials", summary: "Review the selected role and prepare tailored application materials for your approval." },
  { action: "follow_up", title: "Prepare recruiter follow-up", summary: "Draft a professional follow-up for an existing application. Review before sending." },
  { action: "review", title: "Review career pipeline", summary: "Review application statuses and identify the next useful candidate action." },
  { action: "apply", title: "Prepare application for approval", summary: "Prepare the application workflow. No application will be submitted automatically." },
] as const;

export default function CareerAgentExecution() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/career-execution/tasks");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load career tasks.");
      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load career tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createTask(template: typeof taskTemplates[number]) {
    setBusyAction(template.action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/career-execution/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...template, requiresApproval: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to queue this task.");
      setNotice("Task queued and waiting for your approval.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue this task.");
    } finally {
      setBusyAction(null);
    }
  }

  async function transition(task: Task, event: string) {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/career-execution/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, event }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to update this task.");
      setNotice("Task updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this task.");
    }
  }

  return (
    <section id="execution-control" className="hh-panel">
      <div className="hh-panel-heading">
        <div><small>AGENT EXECUTION · PHASE 30</small><h2>Approval-gated autonomous actions</h2></div>
        <span>HUMAN CONTROL</span>
      </div>
      <p className="text-sm text-white/50">Queue career work for the agent to organize. Applications and recruiter communications remain under your control; these tasks do not submit or send anything externally.</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-white/60">Queue a task</p>
        <div className="flex flex-wrap gap-2">
          {taskTemplates.map((template) => (
            <button
              key={template.action}
              type="button"
              disabled={busyAction !== null}
              onClick={() => void createTask(template)}
              className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50"
            >
              {busyAction === template.action ? "Queueing…" : template.title}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}

      <div className="mt-4 space-y-3">
        {loading ? <p className="text-sm text-white/35">Loading execution tasks…</p> : tasks.length === 0 ? (
          <p className="text-sm text-white/35">No execution tasks queued yet.</p>
        ) : tasks.slice(0, 8).map((task) => (
          <div key={task.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
            <div className="flex justify-between gap-3">
              <div><strong>{task.title}</strong><p className="mt-1 text-xs text-white/45">{task.summary}</p></div>
              <span className="shrink-0 text-xs capitalize text-white/45">{task.state.replaceAll("_", " ")}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {task.state === "awaiting_approval" && <button type="button" onClick={() => void transition(task, "approve")} className="rounded-lg border border-cyan-400/20 px-3 py-1.5 text-xs text-cyan-100">Approve</button>}
              {task.state === "approved" && <button type="button" onClick={() => void transition(task, "start")} className="rounded-lg border border-cyan-400/20 px-3 py-1.5 text-xs text-cyan-100">Start</button>}
              {task.state === "executing" && <button type="button" onClick={() => void transition(task, "complete")} className="rounded-lg border border-emerald-400/20 px-3 py-1.5 text-xs text-emerald-100">Mark complete</button>}
              {!["completed", "cancelled"].includes(task.state) && <button type="button" onClick={() => void transition(task, "cancel")} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/55">Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
