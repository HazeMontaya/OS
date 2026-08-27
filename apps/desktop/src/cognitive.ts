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
