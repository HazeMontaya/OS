import { FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import CognitiveVoid from "./CognitiveVoid";

type SystemSnapshot = {
  kernel_online: boolean;
  event_count: number;
  memory_count: number;
  node_count: number;
  edge_count: number;
};

const emptySnapshot: SystemSnapshot = {
  kernel_online: false,
  event_count: 0,
  memory_count: 0,
  node_count: 0,
  edge_count: 0,
};

export default function App() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySnapshot);
  const [input, setInput] = useState("");

  const refresh = async () => {
    try {
      setSnapshot(await invoke<SystemSnapshot>("system_snapshot"));
    } catch {
      setSnapshot(emptySnapshot);
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
      <CognitiveVoid activity={snapshot.event_count} />

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
          <span>{snapshot.node_count} NODES</span>
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
