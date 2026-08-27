import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import AnalyticsPanel from "./analytics/AnalyticsPanel";
import CognitiveVoid from "./CognitiveVoid";
import {
  AskResult,
  CognitiveActivity,
  CognitiveActivityPhase,
  emptyGraph,
  emptySystemSnapshot,
  GraphSnapshot,
  SystemSnapshot,
} from "./cognitive";

export default function App() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySystemSnapshot);
  const [graph, setGraph] = useState<GraphSnapshot>(emptyGraph);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityPhase, setActivityPhase] = useState<CognitiveActivityPhase | null>(null);
  const [activityComponent, setActivityComponent] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const refresh = async () => {
    try {
      const [systemState, graphState] = await Promise.all([
        invoke<SystemSnapshot>("system_snapshot"),
        invoke<GraphSnapshot>("graph_snapshot"),
      ]);
      setSnapshot(systemState);
      setGraph(graphState);
    } catch {
      setSnapshot(emptySystemSnapshot);
      setGraph(emptyGraph);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<CognitiveActivity>("cognitive-activity", (event) => {
      const activity = event.payload;
      if (activity.active) {
        setActivityPhase(activity.phase);
        setActivityComponent(activity.component);
      } else {
        setActivityPhase(null);
        setActivityComponent(activity.component);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => unlisten?.();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;

    setBusy(true);
    setError(null);
    setAnswer(null);
    setInput("");

    try {
      const result = await invoke<AskResult>("ask", { content });
      setAnswer(result);
    } catch (cause) {
      setError(String(cause));
    } finally {
      await refresh();
      setActivityPhase(null);
      setBusy(false);
    }
  };

  const activePanel = busy || answer !== null || error !== null;
  const livePhaseLabel = activityPhase
    ? activityPhase.replaceAll("_", " ").toUpperCase()
    : null;

  return (
    <main className={`shell${analyticsOpen ? " analytics-visible" : ""}`}>
      <CognitiveVoid
        graph={graph}
        activity={snapshot.event_count + (busy ? 1 : 0)}
        phase={activityPhase}
      />

      <header className="topbar glass">
        <div>
          <span className="brand-mark" />
          <strong>OS</strong>
          <span className="muted">cognitive environment</span>
        </div>
        <div className="telemetry">
          <span className={snapshot.kernel_online ? "online" : "offline"}>
            {snapshot.kernel_online ? "KERNEL ONLINE" : "WEB PREVIEW"}
          </span>
          {livePhaseLabel && <span className="live-activity">{livePhaseLabel}</span>}
          <span>{snapshot.event_count} EVENTS</span>
          <span>{snapshot.memory_count} MEMORIES</span>
          <span>{snapshot.node_count} NODES</span>
          <span>{snapshot.edge_count} EDGES</span>
          <button
            type="button"
            className={`top-action${analyticsOpen ? " active" : ""}`}
            onClick={() => setAnalyticsOpen((open) => !open)}
            aria-pressed={analyticsOpen}
          >
            ANALYTICS
          </button>
        </div>
      </header>

      {analyticsOpen && (
        <AnalyticsPanel
          snapshot={snapshot}
          graph={graph}
          phase={activityPhase}
          busy={busy}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {!activePanel && (
        <section className="focus-copy">
          <p className="eyebrow">ACTIVE CONTEXT</p>
          <h1>Cognition is the interface.</h1>
          <p>
            Memory, knowledge, agents, tools and execution traces become one navigable state model.
          </p>
        </section>
      )}

      {activePanel && (
        <section className="response-panel glass" aria-live="polite">
          <header>
            <span className="eyebrow">COGNITIVE OUTPUT</span>
            <span className="response-meta">
              {busy
                ? `${livePhaseLabel ?? "COGNITIVE TURN"}${activityComponent ? ` · ${activityComponent}` : ""}`
                : answer?.model ?? "MODEL ERROR"}
            </span>
          </header>

          {busy && (
            <div className="thinking-state">
              <span className="thinking-orbit" />
              <p>{livePhaseLabel ?? "Processing cognition"}…</p>
            </div>
          )}

          {!busy && error && <p className="response-error">{error}</p>}

          {!busy && answer && (
            <>
              <div className="response-text">{answer.text}</div>
              <footer>
                <span>{answer.context.items.length} recalled memories</span>
                <span>output persisted to cognition</span>
              </footer>
            </>
          )}
        </section>
      )}

      <form className="command glass" onSubmit={submit}>
        <span className="prompt">›</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask, command, search, create…"
          aria-label="OS command input"
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          {busy ? "THINKING" : "ENTER"}
        </button>
      </form>
    </main>
  );
}
