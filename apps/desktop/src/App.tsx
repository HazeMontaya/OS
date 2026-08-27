import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import CognitiveVoid from "./CognitiveVoid";
import {
  emptyGraph,
  emptySystemSnapshot,
  GraphSnapshot,
  SystemSnapshot,
} from "./cognitive";

export default function App() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySystemSnapshot);
  const [graph, setGraph] = useState<GraphSnapshot>(emptyGraph);
  const [input, setInput] = useState("");

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content) return;
    await invoke("ingest_event", { content });
    setInput("");
    await refresh();
  };

  return (
    <main className="shell">
      <CognitiveVoid graph={graph} activity={snapshot.event_count} />

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
          <span>{snapshot.event_count} EVENTS</span>
          <span>{snapshot.memory_count} MEMORIES</span>
          <span>{snapshot.node_count} NODES</span>
          <span>{snapshot.edge_count} EDGES</span>
        </div>
      </header>

      <section className="focus-copy">
        <p className="eyebrow">ACTIVE CONTEXT</p>
        <h1>Cognition is the interface.</h1>
        <p>
          Memory, knowledge, agents, tools and execution traces become one navigable state model.
        </p>
      </section>

      <form className="command glass" onSubmit={submit}>
        <span className="prompt">›</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask, command, search, create…"
          aria-label="OS command input"
        />
        <button type="submit">ENTER</button>
      </form>
    </main>
  );
}
