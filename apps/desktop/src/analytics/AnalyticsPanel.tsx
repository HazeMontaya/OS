import { useEffect, useMemo, useState } from "react";
import type {
  CognitiveActivityPhase,
  CognitiveActivityRecord,
  GraphSnapshot,
  SystemSnapshot,
} from "../cognitive";
import EChart, { type OSChartOption } from "./EChart";

type AnalyticsPanelProps = {
  snapshot: SystemSnapshot;
  graph: GraphSnapshot;
  phase: CognitiveActivityPhase | null;
  busy: boolean;
  activityHistory: CognitiveActivityRecord[];
  onClose: () => void;
};

type RuntimeSample = {
  time: string;
  events: number;
  memories: number;
  nodes: number;
  edges: number;
};

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function traceStatus(activity: CognitiveActivityRecord) {
  if (activity.active) return "start";
  if (activity.success === false) return "failed";
  if (activity.success === true) return "complete";
  return "end";
}

export default function AnalyticsPanel({
  snapshot,
  graph,
  phase,
  busy,
  activityHistory,
  onClose,
}: AnalyticsPanelProps) {
  const [samples, setSamples] = useState<RuntimeSample[]>([]);

  useEffect(() => {
    setSamples((current) => {
      const next: RuntimeSample = {
        time: nowLabel(),
        events: snapshot.event_count,
        memories: snapshot.memory_count,
        nodes: snapshot.node_count,
        edges: snapshot.edge_count,
      };
      const latest = current.at(-1);
      if (
        latest &&
        latest.events === next.events &&
        latest.memories === next.memories &&
        latest.nodes === next.nodes &&
        latest.edges === next.edges
      ) {
        return current;
      }
      return [...current, next].slice(-40);
    });
  }, [snapshot]);

  const nodeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of graph.nodes) {
      counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8);
  }, [graph]);

  const visibleTrace = useMemo(
    () => [...activityHistory].reverse().slice(0, 10),
    [activityHistory],
  );

  const runtimeOption = useMemo<OSChartOption>(
    () => ({
      animationDuration: 360,
      grid: { left: 30, right: 12, top: 12, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: samples.map((sample) => sample.time),
        axisLabel: { color: "rgba(214,232,255,.38)", fontSize: 9 },
        axisLine: { lineStyle: { color: "rgba(150,205,255,.10)" } },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "rgba(214,232,255,.34)", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(150,205,255,.07)" } },
      },
      series: [
        {
          name: "Events",
          type: "line",
          smooth: 0.35,
          symbol: "none",
          data: samples.map((sample) => sample.events),
          lineStyle: { width: 1.5, color: "#74c8ff" },
          areaStyle: { color: "rgba(63,164,255,.08)" },
        },
        {
          name: "Memories",
          type: "line",
          smooth: 0.35,
          symbol: "none",
          data: samples.map((sample) => sample.memories),
          lineStyle: { width: 1.25, color: "#73f4da" },
        },
      ],
    }),
    [samples],
  );

  const graphOption = useMemo<OSChartOption>(
    () => ({
      animationDuration: 420,
      grid: { left: 78, right: 12, top: 6, bottom: 18 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "rgba(214,232,255,.34)", fontSize: 9 },
        splitLine: { lineStyle: { color: "rgba(150,205,255,.07)" } },
      },
      yAxis: {
        type: "category",
        data: nodeDistribution.map(([kind]) => kind.replaceAll("_", " ")),
        axisLabel: { color: "rgba(224,239,255,.52)", fontSize: 9 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Nodes",
          type: "bar",
          data: nodeDistribution.map(([, count]) => count),
          barMaxWidth: 8,
          itemStyle: {
            color: "rgba(116,200,255,.62)",
            borderRadius: [0, 5, 5, 0],
          },
        },
      ],
    }),
    [nodeDistribution],
  );

  return (
    <aside className="analytics-panel glass" aria-label="OS analytics">
      <header className="analytics-header">
        <div>
          <span className="eyebrow">LIVE ANALYTICS</span>
          <strong>System telemetry</strong>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close analytics">
          ×
        </button>
      </header>

      <div className="analytics-status">
        <span className={snapshot.kernel_online ? "status-orb online-orb" : "status-orb"} />
        <span>{snapshot.kernel_online ? "KERNEL ONLINE" : "PREVIEW MODE"}</span>
        <span className="analytics-phase">
          {busy ? (phase ?? "processing").replaceAll("_", " ") : "idle"}
        </span>
      </div>

      <section className="metric-grid">
        <div><span>Events</span><strong>{snapshot.event_count}</strong></div>
        <div><span>Memory</span><strong>{snapshot.memory_count}</strong></div>
        <div><span>Nodes</span><strong>{snapshot.node_count}</strong></div>
        <div><span>Edges</span><strong>{snapshot.edge_count}</strong></div>
      </section>

      <section className="analytics-block trace-block">
        <div className="analytics-block-title">
          <span>Execution trace</span>
          <small>{activityHistory.length} received events</small>
        </div>
        {visibleTrace.length > 0 ? (
          <div className="trace-list">
            {visibleTrace.map((activity) => {
              const status = traceStatus(activity);
              return (
                <div className={`trace-row trace-${status}`} key={activity.id}>
                  <span className="trace-marker" />
                  <time>
                    {new Date(activity.received_at_ms).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                  <div>
                    <strong>{activity.phase.replaceAll("_", " ")}</strong>
                    <small>{activity.component}</small>
                  </div>
                  <span className="trace-state">{status}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="analytics-empty trace-empty">
            Execution events appear here when the cognitive runtime becomes active.
          </div>
        )}
      </section>

      <section className="analytics-block">
        <div className="analytics-block-title">
          <span>Runtime growth</span>
          <small>real snapshots</small>
        </div>
        <EChart option={runtimeOption} className="runtime-chart" />
      </section>

      <section className="analytics-block graph-block">
        <div className="analytics-block-title">
          <span>Knowledge topology</span>
          <small>{graph.nodes.length} visible nodes</small>
        </div>
        {nodeDistribution.length > 0 ? (
          <EChart option={graphOption} className="distribution-chart" />
        ) : (
          <div className="analytics-empty">Graph telemetry appears when cognition creates nodes.</div>
        )}
      </section>
    </aside>
  );
}
