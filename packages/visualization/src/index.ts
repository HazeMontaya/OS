import type { WorkspaceId } from "@os/protocol";

export type SemanticZoomLevel = "universe" | "cluster" | "network" | "detail" | "inspect";

export type WorkspaceDefinition = {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  purpose: string;
  preferredCamera: "FREE" | "FOCUS" | "FOLLOW" | "TRACE" | "OVERVIEW" | "CINEMATIC";
};

export const WORKSPACES: WorkspaceDefinition[] = [
  { id: "main", label: "Main Void", shortLabel: "MAIN", purpose: "Current cognition and active context", preferredCamera: "FOCUS" },
  { id: "knowledge", label: "Knowledge Void", shortLabel: "KNOWLEDGE", purpose: "Temporal concepts, entities and relations", preferredCamera: "OVERVIEW" },
  { id: "memory", label: "Memory Void", shortLabel: "MEMORY", purpose: "Episodic, semantic and historical memory", preferredCamera: "OVERVIEW" },
  { id: "agents", label: "Agent Void", shortLabel: "AGENTS", purpose: "Agent identities, plans, permissions and traces", preferredCamera: "FOLLOW" },
  { id: "developer", label: "Developer Void", shortLabel: "DEV", purpose: "Events, IPC, traces and renderer diagnostics", preferredCamera: "TRACE" },
  { id: "system", label: "System Void", shortLabel: "SYSTEM", purpose: "Processes, devices and capability boundaries", preferredCamera: "OVERVIEW" },
  { id: "settings", label: "Settings Void", shortLabel: "SETTINGS", purpose: "Persistent configuration and quality controls", preferredCamera: "FOCUS" },
  { id: "automation", label: "Automation Void", shortLabel: "AUTOMATION", purpose: "Trigger-to-action workflow graphs", preferredCamera: "OVERVIEW" },
];

export function workspaceById(id: WorkspaceId) {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? WORKSPACES[0];
}
