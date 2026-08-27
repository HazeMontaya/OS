export type WorkspaceId =
  | "main"
  | "knowledge"
  | "memory"
  | "agents"
  | "developer"
  | "system"
  | "settings"
  | "automation";

export type CapabilityMode = "ALLOW" | "ASK" | "DENY" | "SANDBOX";

export type TraceIdentity = {
  eventId: string;
  traceId: string;
  parentEventId: string | null;
  sessionId: string;
  timestampMs: number;
};

export type OsEvent<TPayload = unknown> = TraceIdentity & {
  source: string;
  target: string | null;
  eventType: string;
  status: "started" | "progress" | "completed" | "failed" | "blocked";
  durationMs: number | null;
  confidence: number | null;
  payload: TPayload;
};

export type StateDelta<TState = unknown> = {
  protocolVersion: 1;
  revision: number;
  traceId: string | null;
  changedPaths: string[];
  state: Partial<TState>;
};

export type CapabilityDescriptor = {
  id: string;
  mode: CapabilityMode;
  riskLevel: 0 | 1 | 2 | 3 | 4;
  scope: string;
};
