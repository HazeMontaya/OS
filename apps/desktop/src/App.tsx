import { type CSSProperties, FormEvent, useEffect, useState } from "react";
import type { WorkspaceId } from "@os/protocol";
import { getTheme, themeCssVariables } from "@os/design-system";
import { RENDER_PROFILES } from "@os/renderer";
import { workspaceById } from "@os/visualization";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import AnalyticsPanel from "./analytics/AnalyticsPanel";
import OsMark from "./brand/OsMark";
import NodeInspector from "./inspector/NodeInspector";
import SpatialRenderer from "./rendering/SpatialRendererV4";
import SettingsPanel from "./settings/SettingsPanel";
import { useOsSettings } from "./settings/useOsSettings";
import WorkspaceDock from "./workspaces/WorkspaceDock";
import {
  type AskResult,
  type CognitiveActivity,
  type CognitiveActivityPhase,
  type CognitiveActivityRecord,
  emptyGraph,
  emptySystemSnapshot,
  type GraphSnapshot,
  type SystemSnapshot,
} from "./cognitive";

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

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
      setActivityHistory((current) => [...current, record].slice(-64));
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
    setSelectedNodeId(null);
  };

  const activePanel = busy || answer !== null || error !== null;
  const livePhaseLabel = activityPhase ? activityPhase.replaceAll("_", " ").toUpperCase() : null;
  const selectedNode = selectedNodeId ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const densityClass = `density-${settings.interfaceDensity.toLowerCase()}`;
  const activeWorkspace = workspaceById(activeWorkspaceId);
  const renderProfile = RENDER_PROFILES[settings.renderQuality];
  const activeTheme = getTheme(settings.themeId);
  const themeStyle = {
    ...themeCssVariables(settings.themeId),
    "--os-glass-top": hexToRgba(activeTheme.surfaceRaised, settings.panelOpacity),
    "--os-glass-bottom": hexToRgba(activeTheme.canvas, settings.panelOpacity * 0.92),
    "--os-panel-opacity": String(settings.panelOpacity),
  } as CSSProperties;

  return (
    <main
      data-workspace={activeWorkspaceId}
      data-theme={settings.themeId}
      style={themeStyle}
      className={`shell ${densityClass}${analyticsOpen ? " analytics-visible" : ""}${settings.reducedMotion ? " reduced-motion" : ""}${settings.cinematicGrain ? " cinematic-grain" : ""}`}
    >
      <SpatialRenderer
        graph={graph}
        activity={snapshot.event_count + (busy ? 1 : 0)}
        phase={activityPhase}
        workspaceId={activeWorkspaceId}
        settings={settings}
        selectedNodeId={selectedNodeId}
        onSelectNode={(node) => setSelectedNodeId(node?.id ?? null)}
      />

      <div className="shell-vignette" aria-hidden="true" />
      <div className="shell-grid" aria-hidden="true" />
      <div className="shell-scan" aria-hidden="true" />

      <WorkspaceDock active={activeWorkspaceId} onChange={handleWorkspaceChange} />

      <header className="topbar glass">
        <div className="brand-lockup">
          <OsMark className="brand-logo" />
          <div className="brand-copy">
            <strong>OS</strong>
            <span>COGNITIVE OPERATING SYSTEM</span>
          </div>
          <span className="workspace-crumb">/ {activeWorkspace.shortLabel}</span>
        </div>

        <div className="telemetry">
          <span className={snapshot.kernel_online ? "online" : "offline"}>
            {snapshot.kernel_online ? "KERNEL ONLINE" : "WEB PREVIEW"}
          </span>
          {livePhaseLabel && <span className="live-activity">{livePhaseLabel}</span>}
          {settings.telemetryVisible && (
            <>
              <span>{snapshot.event_count} EVT</span>
              <span>{snapshot.memory_count} MEM</span>
              <span>{snapshot.node_count} NODES</span>
              <span>{snapshot.edge_count} REL</span>
              <span>{renderProfile.label} / {settings.targetFps}</span>
            </>
          )}
          <button type="button" className={`top-action${analyticsOpen ? " active" : ""}`} onClick={() => setAnalyticsOpen((open) => !open)} aria-pressed={analyticsOpen}>ANALYTICS</button>
          <button type="button" className={`top-action${settingsOpen ? " active" : ""}`} onClick={() => handleWorkspaceChange(settingsOpen ? "main" : "settings")} aria-pressed={settingsOpen}>CONFIG</button>
        </div>
      </header>

      {analyticsOpen && !settingsOpen && (
        <AnalyticsPanel
          snapshot={snapshot}
          graph={graph}
          phase={activityPhase}
          busy={busy}
          activityHistory={activityHistory}
          themeId={settings.themeId}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel settings={settings} onChange={patchSettings} onReset={resetSettings} onClose={() => handleWorkspaceChange("main")} />
      )}

      {selectedNode && !settingsOpen && (
        <NodeInspector node={selectedNode} graph={graph} onClose={() => setSelectedNodeId(null)} />
      )}

      {!activePanel && !settingsOpen && (
        <section className="focus-copy">
          <p className="eyebrow">{activeWorkspace.glyph} {activeWorkspace.shortLabel} · {activeWorkspace.preferredCamera}</p>
          <h1>{activeWorkspace.label}</h1>
          <p>{activeWorkspace.purpose}.</p>
          <div className="focus-rule" aria-hidden="true"><span /><i /><span /></div>
          <div className="focus-meta">
            <span>CANONICAL STATE</span>
            <b>LIVE PROJECTION</b>
            <span>BLACK / GOLD v2</span>
          </div>
        </section>
      )}

      {activePanel && !settingsOpen && (
        <section className="response-panel glass" aria-live="polite">
          <header>
            <div>
              <span className="eyebrow">COGNITIVE OUTPUT</span>
              <strong>{busy ? "ACTIVE INFERENCE" : "RESULT"}</strong>
            </div>
            <span className="response-meta">
              {busy ? `${livePhaseLabel ?? "COGNITIVE TURN"}${activityComponent ? ` · ${activityComponent}` : ""}` : answer?.model ?? "MODEL ERROR"}
            </span>
          </header>

          {busy && (
            <div className="thinking-state">
              <span className="thinking-orbit"><i /></span>
              <p>{livePhaseLabel ?? "Processing cognition"}…</p>
            </div>
          )}

          {!busy && error && <p className="response-error">{error}</p>}

          {!busy && answer && (
            <>
              <div className="response-text">{answer.text}</div>
              <footer>
                <span>{answer.context.items.length} RECALLED MEMORIES</span>
                <span>PROVENANCE PRESERVED</span>
                <span>OUTPUT PERSISTED</span>
              </footer>
            </>
          )}
        </section>
      )}

      <form className="command glass" onSubmit={submit}>
        <span className="command-sigil">⌁</span>
        <div className="command-field">
          <span>{activeWorkspace.shortLabel}</span>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask · command · search · create · orchestrate" aria-label="OS command input" disabled={busy} />
        </div>
        <button type="submit" disabled={busy}>{busy ? "PROCESSING" : "EXECUTE"}</button>
      </form>
    </main>
  );
}
