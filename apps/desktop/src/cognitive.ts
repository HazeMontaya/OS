export type MemoryKind =
  | "working"
  | "episodic"
  | "semantic"
  | "procedural"
  | "stable"
  | "preference"
  | "project"
  | "self_model"
  | "world_model";

export type ContextItem = {
  id: string;
  text: string;
  kind: MemoryKind;
  score: number;
  confidence: number;
  provenance: string[];
};

export type ContextPack = {
  query: string;
  items: ContextItem[];
};

export type AskResult = {
  text: string;
  model: string;
  context: ContextPack;
};

export type CognitiveActivityPhase =
  | "memory_recall"
  | "model_inference"
  | "output_persist";

export type CognitiveActivity = {
  phase: CognitiveActivityPhase;
  active: boolean;
  success: boolean | null;
  component: string;
};

export type CognitiveActivityRecord = CognitiveActivity & {
  id: string;
  received_at_ms: number;
};

export type CognitiveNode = {
  id: string;
  kind: string;
  label: string;
  importance: number;
  confidence: number;
};

export type CognitiveEdge = {
  id: string;
  from: string;
  to: string;
  relation: string;
  weight: number;
  valid_from_ms: number;
  valid_until_ms: number | null;
  provenance: string[];
};

export type GraphSnapshot = {
  nodes: CognitiveNode[];
  edges: CognitiveEdge[];
};

export type SystemSnapshot = {
  kernel_online: boolean;
  event_count: number;
  memory_count: number;
  node_count: number;
  edge_count: number;
};

export const emptyGraph: GraphSnapshot = { nodes: [], edges: [] };

export const emptySystemSnapshot: SystemSnapshot = {
  kernel_online: false,
  event_count: 0,
  memory_count: 0,
  node_count: 0,
  edge_count: 0,
};
