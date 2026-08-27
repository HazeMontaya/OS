import type { WorkspaceId } from "@os/protocol";

export type SemanticZoomLevel = "universe" | "cluster" | "network" | "detail" | "inspect";
export type CameraMode = "FREE" | "FOCUS" | "FOLLOW" | "TRACE" | "OVERVIEW" | "CINEMATIC";
export type SpatialLayoutMode =
  | "COGNITIVE_CONSTELLATION"
  | "KNOWLEDGE_SPHERE"
  | "TEMPORAL_HELIX"
  | "EXECUTION_ORBITS"
  | "TRACE_MATRIX"
  | "SYSTEM_RINGS"
  | "CONFIGURATION_CHAMBER"
  | "AUTOMATION_CIRCUIT";

export type WorkspaceDefinition = {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  glyph: string;
  purpose: string;
  preferredCamera: CameraMode;
  layoutMode: SpatialLayoutMode;
  cameraRadius: number;
  fogDensity: number;
  orbitalVelocity: number;
  enabledKinds: string[] | null;
};

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: "main",
    label: "Cognitive Core",
    shortLabel: "CORE",
    glyph: "◈",
    purpose: "Current cognition, intent, active memory and live system state",
    preferredCamera: "FOCUS",
    layoutMode: "COGNITIVE_CONSTELLATION",
    cameraRadius: 18,
    fogDensity: 0.012,
    orbitalVelocity: 0.000035,
    enabledKinds: null,
  },
  {
    id: "knowledge",
    label: "Knowledge Constellation",
    shortLabel: "KNOW",
    glyph: "✦",
    purpose: "Temporal concepts, entities, relations, projects and semantic structure",
    preferredCamera: "OVERVIEW",
    layoutMode: "KNOWLEDGE_SPHERE",
    cameraRadius: 30,
    fogDensity: 0.010,
    orbitalVelocity: 0.000055,
    enabledKinds: ["self_model", "semantic_memory", "stable_memory", "goal", "project", "actor"],
  },
  {
    id: "memory",
    label: "Memory Archive",
    shortLabel: "MEM",
    glyph: "◌",
    purpose: "Episodic, semantic and historical memory arranged by importance and persistence",
    preferredCamera: "OVERVIEW",
    layoutMode: "TEMPORAL_HELIX",
    cameraRadius: 27,
    fogDensity: 0.016,
    orbitalVelocity: 0.000025,
    enabledKinds: ["self_model", "episodic_memory", "semantic_memory", "stable_memory", "actor"],
  },
  {
    id: "agents",
    label: "Agent Operations",
    shortLabel: "AGNT",
    glyph: "⬡",
    purpose: "Agent identities, plans, models, permissions, tools and execution traces",
    preferredCamera: "FOLLOW",
    layoutMode: "EXECUTION_ORBITS",
    cameraRadius: 22,
    fogDensity: 0.011,
    orbitalVelocity: 0.000065,
    enabledKinds: ["self_model", "agent", "model", "tool", "goal", "project"],
  },
  {
    id: "developer",
    label: "Developer Matrix",
    shortLabel: "DEV",
    glyph: "⌬",
    purpose: "Events, IPC, providers, traces, renderer diagnostics and implementation telemetry",
    preferredCamera: "TRACE",
    layoutMode: "TRACE_MATRIX",
    cameraRadius: 20,
    fogDensity: 0.008,
    orbitalVelocity: 0.000020,
    enabledKinds: ["self_model", "model", "agent", "tool", "project"],
  },
  {
    id: "system",
    label: "System Fabric",
    shortLabel: "SYS",
    glyph: "◇",
    purpose: "Processes, devices, capabilities, tools and operating boundaries",
    preferredCamera: "OVERVIEW",
    layoutMode: "SYSTEM_RINGS",
    cameraRadius: 25,
    fogDensity: 0.013,
    orbitalVelocity: 0.000030,
    enabledKinds: ["self_model", "tool", "agent", "actor", "project"],
  },
  {
    id: "settings",
    label: "Configuration Chamber",
    shortLabel: "CONF",
    glyph: "◍",
    purpose: "Persistent experience, renderer, theme and quality configuration",
    preferredCamera: "CINEMATIC",
    layoutMode: "CONFIGURATION_CHAMBER",
    cameraRadius: 12,
    fogDensity: 0.022,
    orbitalVelocity: 0.000018,
    enabledKinds: ["self_model"],
  },
  {
    id: "automation",
    label: "Automation Circuit",
    shortLabel: "AUTO",
    glyph: "⟲",
    purpose: "Trigger-to-action workflows, conditions, agents, tools, approvals and outputs",
    preferredCamera: "OVERVIEW",
    layoutMode: "AUTOMATION_CIRCUIT",
    cameraRadius: 24,
    fogDensity: 0.010,
    orbitalVelocity: 0.000045,
    enabledKinds: ["self_model", "agent", "model", "tool", "goal", "project"],
  },
];

export function workspaceById(id: WorkspaceId): WorkspaceDefinition {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? WORKSPACES[0];
}
