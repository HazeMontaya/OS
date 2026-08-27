import { FormEvent, useEffect, useState } from "react";
import type { WorkspaceId } from "@os/protocol";
import { RENDER_PROFILES } from "@os/renderer";
import { workspaceById } from "@os/visualization";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import AnalyticsPanel from "./analytics/AnalyticsPanel";
import CognitiveVoid from "./CognitiveVoid";
import NodeInspector from "./inspector/NodeInspector";
import SettingsPanel from "./settings/SettingsPanel";
import { useOsSettings } from "./settings/useOsSettings";
import WorkspaceDock from "./workspaces/WorkspaceDock";
import {
  AskResult,
  CognitiveActivity,
  CognitiveActivityPhase,
  CognitiveActivityRecord,
  emptyGraph,
  emptySystemSnapshot,
  GraphSnapshot,
  SystemSnapshot,
} from "./cognitive";

export default function App() {
  const { settings, patchSettings, resetSettings } = useOsSettings();
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySystemSnapshot);
  const [graph, setGraph] = useState<GraphSnapshot>(emptyGraph);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityPhase, setActivityPhase] = useState<CognitiveActivityPhase | null>(null);
  const [activityComponent, setActivityComponent] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<CognitiveActivityRecord[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(settings.analyticsDefaultOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<WorkspaceId>("main");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
      const record: CognitiveActivityRecord = {
        ...activity,
        id: crypto.randomUUID(),
        received_at_ms: Date.now(),
      };
      setActivityHistory((current) => [...current, record].slice(-48));

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

  const handleWorkspaceChange = (workspace: WorkspaceId) => {
    setActiveWorkspaceId(workspace);
    setSettingsOpen(workspace === "settings");
    if (workspace !== "settings") setSelectedNodeId(null);
  };

  const activePanel = busy || answer !== null || error !== null;
  const livePhaseLabel = activityPhase
    ? activityPhase.replaceAll("_", " ").toUpperCase()
    : null;
  const selectedNode = selectedNodeId
    ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const densityClass = `density-${settings.interfaceDensity.toLowerCase()}`;
  const activeWorkspace = workspaceById(activeWorkspaceId);
  const renderProfile = RENDER_PROFILES[settings.renderQuality];

  return (
    <main
      data-workspace={activeWorkspaceId}
      className={`shell${analyticsOpen ? " analytics-visible" : ""} ${densityClass}${settings.reducedMotion ? " reduced-motion" : ""}`}
    >
      <CognitiveVoid
        graph={graph}
        activity={snapshot.event_count + (busy ? 1 : 0)}
        phase={activityPhase}
        selectedNodeId={selectedNodeId}
        onSelectNode={(node) => setSelectedNodeId(node?.id ?? null)}
      />

      <WorkspaceDock active={activeWorkspaceId} onChange={handleWorkspaceChange} />

      <header className="topbar glass">
        <div>
          <span className="brand-mark" />
          <strong>OS</strong>
          <span className="muted">{activeWorkspace.label.toLowerCase()}</span>
        </div>
        <div className="telemetry">
          <span className={snapshot.kernel_online ? "online" : "offline"}>
            {snapshot.kernel_online ? "KERNEL ONLINE" : "WEB PREVIEW"}
          </span>
          {livePhaseLabel && <span className="live-activity">{livePhaseLabel}</span>}
          {settings.telemetryVisible && (
            <>
              <span>{snapshot.event_count} EVENTS</span>
              <span>{snapshot.memory_count} MEMORIES</span>
              <span>{snapshot.node_count} NODES</span>
              <span>{snapshot.edge_count} EDGES</span>
              <span>{renderProfile.label} · {settings.targetFps} FPS</span>
            </>
          )}
          <button
            type="button"
            className={`top-action${analyticsOpen ? " active" : ""}`}
            onClick={() => setAnalyticsOpen((open) => !open)}
            aria-pressed={analyticsOpen}
          >
            ANALYTICS
          </button>
          <button
            type="button"
            className={`top-action${settingsOpen ? " active" : ""}`}
            onClick={() => handleWorkspaceChange(settingsOpen ? "main" : "settings")}
            aria-pressed={settingsOpen}
          >
            SETTINGS
          </button>
        </div>
      </header>

      {analyticsOpen && !settingsOpen && (
        <AnalyticsPanel
          snapshot={snapshot}
          graph={graph}
          phase={activityPhase}
          busy={busy}
          activityHistory={activityHistory}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={patchSettings}
          onReset={resetSettings}
          onClose={() => handleWorkspaceChange("main")}
        />
      )}

      {selectedNode && !settingsOpen && (
        <NodeInspector
          node={selectedNode}
          graph={graph}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {!activePanel && !settingsOpen && (
        <section className="focus-copy">
          <p className="eyebrow">{activeWorkspace.shortLabel} · ACTIVE CONTEXT</p>
          <h1>{activeWorkspace.label}</h1>
          <p>{activeWorkspace.purpose}. The view remains a projection of canonical OS state.</p>
        </section>
      )}

      {activePanel && !settingsOpen && (
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
          placeholder={`${activeWorkspace.shortLabel} · Ask, command, search, create…`}
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
