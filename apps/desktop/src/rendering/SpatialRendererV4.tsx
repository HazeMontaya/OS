import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceId } from "@os/protocol";
import { getTheme, OS_SEMANTIC_GOLD } from "@os/design-system";
import {
  adaptiveResolutionScale,
  RENDER_PROFILES,
  resolveGpuSignalBudget,
  resolveRenderBudget,
} from "@os/renderer";
import {
  workspaceById,
  type CameraMode,
  type SemanticZoomLevel,
  type SpatialLayoutMode,
} from "@os/visualization";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";
import { Scene } from "@babylonjs/core/scene";
import type {
  CognitiveActivityPhase,
  CognitiveEdge,
  CognitiveNode,
  GraphSnapshot,
} from "../cognitive";
import type { OsSettings } from "../settings/useOsSettings";
import LegacySpatialRenderer from "./SpatialRenderer";
import { CameraDirector } from "./CameraDirector";
import { GpuGraphField, type GpuGraphEdge, type GpuGraphNode } from "./GpuGraphField";
import { GpuSignalField } from "./GpuSignalField";
import { graphTopologySignature } from "./ProjectionDelta";
import { SpatialPickIndex } from "./SpatialPickIndex";

type Props = {
  graph: GraphSnapshot;
  activity: number;
  phase: CognitiveActivityPhase | null;
  workspaceId: WorkspaceId;
  settings: OsSettings;
  selectedNodeId: string | null;
  onSelectNode: (node: CognitiveNode | null) => void;
};

type HoverInfo = {
  id: string;
  label: string;
  kind: string;
  importance: number;
  confidence: number;
} | null;

type ClusterPlan = {
  kind: string;
  center: Vector3;
  count: number;
};

type ProjectionPlan = {
  key: string;
  topologySignature: string;
  visibleNodes: CognitiveNode[];
  visibleEdges: CognitiveEdge[];
  labelNodeIds: string[];
  positions: Map<string, Vector3>;
  sizes: Map<string, number>;
  nodeById: Map<string, CognitiveNode>;
  clusters: ClusterPlan[];
  pickIndex: SpatialPickIndex;
};

type TraceRoute = {
  from: Vector3;
  to: Vector3;
  offset: number;
};

type VisualLayer = {
  plan: ProjectionPlan;
  resources: Array<{ dispose: () => void }>;
  traceResources: Array<{ dispose: () => void }>;
  labels: Mesh[];
  labelByNodeId: Map<string, Mesh>;
  clusters: Mesh[];
  clusterLabels: Mesh[];
  coreRings: Mesh[];
  focusHalo: Mesh;
  traceSystem: SolidParticleSystem | null;
  traceRoutes: TraceRoute[];
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_TRACE_PACKETS = 48;
const CAMERA_MODES: CameraMode[] = ["FREE", "FOCUS", "FOLLOW", "TRACE", "OVERVIEW", "CINEMATIC"];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function hashStrings(values: string[]) {
  let hash = 2166136261;
  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 124;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseHex(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;
  const value = Number.parseInt(expanded, 16);
  return new Color3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function semanticHex(kind: string) {
  switch (kind) {
    case "self_model": return OS_SEMANTIC_GOLD.core;
    case "actor": return OS_SEMANTIC_GOLD.actor;
    case "episodic_memory": return OS_SEMANTIC_GOLD.episodicMemory;
    case "semantic_memory": return OS_SEMANTIC_GOLD.semanticMemory;
    case "stable_memory": return OS_SEMANTIC_GOLD.stableMemory;
    case "model": return OS_SEMANTIC_GOLD.model;
    case "agent": return OS_SEMANTIC_GOLD.agent;
    case "tool": return OS_SEMANTIC_GOLD.tool;
    case "goal": return OS_SEMANTIC_GOLD.goal;
    case "project": return OS_SEMANTIC_GOLD.project;
    default: return OS_SEMANTIC_GOLD.semanticMemory;
  }
}

function semanticZoom(radius: number): SemanticZoomLevel {
  if (radius >= 36) return "universe";
  if (radius >= 23) return "cluster";
  if (radius >= 12) return "network";
  if (radius >= 6.5) return "detail";
  return "inspect";
}

function baseClusterRadius(kind: string) {
  switch (kind) {
    case "self_model": return 0;
    case "actor": return 4.8;
    case "goal": return 6.4;
    case "project": return 7.4;
    case "episodic_memory": return 9.2;
    case "semantic_memory": return 11;
    case "stable_memory": return 12.2;
    case "agent": return 8.4;
    case "model": return 10;
    case "tool": return 12.8;
    default: return 10.8;
  }
}

function kindLane(kind: string) {
  switch (kind) {
    case "goal": return -5;
    case "project": return -4;
    case "actor": return -3;
    case "agent": return -2;
    case "self_model": return 0;
    case "model": return 1;
    case "tool": return 2;
    case "episodic_memory": return 3;
    case "semantic_memory": return 4;
    case "stable_memory": return 5;
    default: return 0;
  }
}

function clusterSeed(kind: string, workspaceId: WorkspaceId) {
  if (kind === "self_model") return Vector3.Zero();
  const angle = hashUnit(`${workspaceId}:${kind}:angle`) * Math.PI * 2;
  const radius = baseClusterRadius(kind) * (0.82 + hashUnit(`${workspaceId}:${kind}:radius`) * 0.32);
  const y = (hashUnit(`${workspaceId}:${kind}:y`) - 0.5) * Math.min(6.5, radius * 0.46);
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function constellationPosition(node: CognitiveNode, localIndex: number, workspaceId: WorkspaceId) {
  if (node.kind === "self_model") return Vector3.Zero();
  const center = clusterSeed(node.kind, workspaceId);
  const angle = localIndex * GOLDEN_ANGLE + hashUnit(`${workspaceId}:${node.id}`) * Math.PI * 2;
  const localRadius = 0.55 + hashUnit(`${node.id}:local`) * 2.05;
  const y = (hashUnit(`${node.id}:vertical`) - 0.5) * 2.45;
  return center.add(new Vector3(Math.cos(angle) * localRadius, y, Math.sin(angle) * localRadius));
}

function knowledgeSpherePosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const shell = baseClusterRadius(node.kind) * 0.68 + 5.5;
  const yUnit = 1 - 2 * hashUnit(`${node.id}:knowledge-y`);
  const planar = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
  const angle = localIndex * GOLDEN_ANGLE + hashUnit(`${node.id}:knowledge-a`) * Math.PI * 2;
  const radius = shell + (hashUnit(`${node.id}:knowledge-r`) - 0.5) * 2.2;
  return new Vector3(Math.cos(angle) * planar * radius, yUnit * radius * 0.82, Math.sin(angle) * planar * radius);
}

function temporalHelixPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const band = node.kind === "stable_memory" ? 3 : node.kind === "semantic_memory" ? 2 : node.kind === "episodic_memory" ? 1 : 0;
  const angle = localIndex * 0.57 + hashUnit(`${node.id}:memory-a`) * 1.4;
  const radius = 7.2 + band * 2.25 + hashUnit(`${node.id}:memory-r`) * 1.6;
  const y = ((localIndex % 41) - 20) * 0.42 + band * 0.72 + (hashUnit(`${node.id}:memory-y`) - 0.5) * 0.7;
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function executionOrbitPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const orbit = node.kind === "agent" ? 5.2 : node.kind === "model" ? 8.1 : node.kind === "tool" ? 11.2 : node.kind === "goal" ? 13.8 : node.kind === "project" ? 15.8 : 9.5;
  const angle = localIndex * GOLDEN_ANGLE + hashUnit(`${node.id}:agent-a`) * Math.PI * 2;
  const radius = orbit + (hashUnit(`${node.id}:agent-r`) - 0.5) * 1.2;
  return new Vector3(Math.cos(angle) * radius, (hashUnit(`${node.id}:agent-y`) - 0.5) * 2.7, Math.sin(angle) * radius);
}

function traceMatrixPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const lane = kindLane(node.kind);
  return new Vector3(
    lane * 3.3 + (hashUnit(`${node.id}:trace-x`) - 0.5) * 0.7,
    (Math.floor(localIndex / 23) - 2) * 1.45 + (hashUnit(`${node.id}:trace-y`) - 0.5) * 0.55,
    ((localIndex % 23) - 11) * 1.18,
  );
}

function systemRingPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const ringIndex = Math.abs(kindLane(node.kind));
  const radius = 6.2 + ringIndex * 2.15 + hashUnit(`${node.id}:system-r`) * 1.1;
  const angle = localIndex * GOLDEN_ANGLE + ringIndex * 0.42 + hashUnit(`${node.id}:system-a`) * 0.6;
  return new Vector3(Math.cos(angle) * radius, kindLane(node.kind) * 0.65 + (hashUnit(`${node.id}:system-y`) - 0.5) * 0.65, Math.sin(angle) * radius);
}

function automationCircuitPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const lane = kindLane(node.kind);
  const row = localIndex % 19;
  return new Vector3(
    lane * 3.4,
    (Math.floor(localIndex / 19) - 1.5) * 1.1 + (hashUnit(`${node.id}:auto-y`) - 0.5) * 0.45,
    (row - 9) * 1.4 + Math.sin((row / 18) * Math.PI) * lane * 0.16,
  );
}

function nodePosition(node: CognitiveNode, localIndex: number, workspaceId: WorkspaceId) {
  const layout: SpatialLayoutMode = workspaceById(workspaceId).layoutMode;
  switch (layout) {
    case "KNOWLEDGE_SPHERE": return knowledgeSpherePosition(node, localIndex);
    case "TEMPORAL_HELIX": return temporalHelixPosition(node, localIndex);
    case "EXECUTION_ORBITS": return executionOrbitPosition(node, localIndex);
    case "TRACE_MATRIX": return traceMatrixPosition(node, localIndex);
    case "SYSTEM_RINGS": return systemRingPosition(node, localIndex);
    case "AUTOMATION_CIRCUIT": return automationCircuitPosition(node, localIndex);
    case "CONFIGURATION_CHAMBER": return node.kind === "self_model" ? Vector3.Zero() : constellationPosition(node, localIndex, workspaceId).scale(0.48);
    default: return constellationPosition(node, localIndex, workspaceId);
  }
}

function nodeVisualSize(node: CognitiveNode) {
  if (node.kind === "self_model") return 1.15;
  return 0.18 + clamp01(node.importance) * 0.34 + clamp01(node.confidence) * 0.14;
}

function workspaceAllows(node: CognitiveNode, workspaceId: WorkspaceId) {
  const workspace = workspaceById(workspaceId);
  return workspace.enabledKinds === null || workspace.enabledKinds.includes(node.kind) || node.kind === "self_model";
}

function nodePriority(node: CognitiveNode, workspaceId: WorkspaceId) {
  let relevance = clamp01(node.importance) * 0.56 + clamp01(node.confidence) * 0.34;
  if (node.kind === "self_model") relevance += 4;
  const workspace = workspaceById(workspaceId);
  if (workspace.enabledKinds?.includes(node.kind)) relevance += 0.18;
  if (workspaceId === "memory" && node.kind.includes("memory")) relevance += 0.28;
  if (workspaceId === "agents" && ["agent", "model", "tool"].includes(node.kind)) relevance += 0.28;
  if (workspaceId === "automation" && ["agent", "tool", "goal", "project"].includes(node.kind)) relevance += 0.2;
  return relevance;
}

function buildProjectionPlan(graph: GraphSnapshot, workspaceId: WorkspaceId, settings: OsSettings): ProjectionPlan {
  const profile = RENDER_PROFILES[settings.renderQuality];
  const budget = resolveRenderBudget(profile, settings.graphDensity, settings.labelDensity, settings.ambientParticles);
  const visibleNodes = graph.nodes
    .filter((node) => workspaceAllows(node, workspaceId))
    .sort((left, right) => nodePriority(right, workspaceId) - nodePriority(left, workspaceId) || left.id.localeCompare(right.id))
    .slice(0, budget.nodes);
  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const visibleIds = new Set(nodeById.keys());
  const visibleEdges = graph.edges
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
    .slice(0, budget.edges);
  const labelNodeIds = visibleNodes
    .filter((node) => node.kind !== "self_model")
    .sort((left, right) => nodePriority(right, workspaceId) - nodePriority(left, workspaceId))
    .slice(0, budget.labels)
    .map((node) => node.id);

  const kindIndexes = new Map<string, number>();
  const positions = new Map<string, Vector3>();
  const sizes = new Map<string, number>();
  const clusterMap = new Map<string, { center: Vector3; count: number }>();
  for (const node of visibleNodes) {
    const localIndex = kindIndexes.get(node.kind) ?? 0;
    kindIndexes.set(node.kind, localIndex + 1);
    const position = nodePosition(node, localIndex, workspaceId);
    positions.set(node.id, position);
    sizes.set(node.id, nodeVisualSize(node));
    const cluster = clusterMap.get(node.kind) ?? { center: Vector3.Zero(), count: 0 };
    cluster.center.addInPlace(position);
    cluster.count += 1;
    clusterMap.set(node.kind, cluster);
  }

  const clusters: ClusterPlan[] = [];
  for (const [kind, cluster] of clusterMap) {
    if (cluster.count > 0) cluster.center.scaleInPlace(1 / cluster.count);
    clusters.push({ kind, center: cluster.center, count: cluster.count });
  }

  const topologySignature = graphTopologySignature(graph);
  const selectionSignature = hashStrings([
    ...visibleNodes.map((node) => `n:${node.id}`),
    ...visibleEdges.map((edge) => `e:${edge.id}`),
    ...labelNodeIds.map((id) => `l:${id}`),
  ]);
  const pickIndex = new SpatialPickIndex(visibleNodes.map((node) => ({
    id: node.id,
    center: positions.get(node.id) ?? Vector3.Zero(),
    radius: node.kind === "self_model" ? 1.5 : 0.82,
  })));

  return {
    key: `${topologySignature}:${selectionSignature}:${workspaceId}`,
    topologySignature,
    visibleNodes,
    visibleEdges,
    labelNodeIds,
    positions,
    sizes,
    nodeById,
    clusters,
    pickIndex,
  };
}

function gpuNodes(plan: ProjectionPlan): GpuGraphNode[] {
  return plan.visibleNodes.map((node) => ({
    id: node.id,
    position: plan.positions.get(node.id) ?? Vector3.Zero(),
    size: plan.sizes.get(node.id) ?? 0.3,
    color: parseHex(semanticHex(node.kind)),
    importance: node.importance,
    confidence: node.confidence,
    core: node.kind === "self_model",
  }));
}

function gpuEdges(plan: ProjectionPlan, settings: OsSettings): GpuGraphEdge[] {
  const theme = getTheme(settings.themeId);
  const current = parseHex(theme.gold);
  const historical = parseHex(theme.bronze);
  return plan.visibleEdges.map((edge) => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    color: edge.valid_until_ms === null ? current : historical,
    weight: Math.max(0, edge.weight * settings.edgeIntensity),
  }));
}

function edgeParticipates(edge: CognitiveEdge, nodeById: Map<string, CognitiveNode>, phase: CognitiveActivityPhase | null) {
  if (!phase || edge.valid_until_ms !== null) return false;
  const from = nodeById.get(edge.from)?.kind ?? "";
  const to = nodeById.get(edge.to)?.kind ?? "";
  if (phase === "memory_recall") return from.includes("memory") || to.includes("memory");
  if (phase === "model_inference") return [from, to].some((kind) => kind === "model" || kind === "self_model" || kind === "agent");
  if (phase === "output_persist") return [from, to].some((kind) => kind === "self_model" || kind === "model" || kind === "episodic_memory");
  return false;
}

function createLabel(scene: Scene, resources: Array<{ dispose: () => void }>, text: string, position: Vector3, color: Color3, id: string, importance: number, cluster = false) {
  const display = text.length > 42 ? `${text.slice(0, 39)}…` : text;
  const width = Math.max(1.5, Math.min(5.6, display.length * 0.105));
  const texture = new DynamicTexture(`os-v4-label-texture:${id}`, { width: 768, height: 112 }, scene, false);
  texture.hasAlpha = true;
  texture.drawText(display, null, 72, cluster ? "600 34px Segoe UI" : "500 29px Segoe UI", cluster ? "#fff0c2" : "#e9d9ad", "transparent", true, true);
  const material = new StandardMaterial(`os-v4-label-material:${id}`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = color.scale(cluster ? 0.9 : 0.68);
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = cluster ? 0.92 : 0.82;
  const plane = MeshBuilder.CreatePlane(`os-v4-label:${id}`, { width, height: cluster ? 0.5 : 0.4 }, scene);
  plane.position.copyFrom(position);
  plane.position.y += cluster ? 1.05 : 0.58;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.material = material;
  plane.isPickable = false;
  plane.renderingGroupId = 2;
  plane.metadata = { importance, cluster };
  resources.push(texture, material, plane);
  return plane;
}

function createVisualLayer(scene: Scene, plan: ProjectionPlan, settings: OsSettings): VisualLayer {
  const resources: Array<{ dispose: () => void }> = [];
  const theme = getTheme(settings.themeId);
  const gold = parseHex(theme.gold);
  const goldBright = parseHex(theme.goldBright);
  const clusters: Mesh[] = [];
  const clusterLabels: Mesh[] = [];

  for (const cluster of plan.clusters) {
    if (cluster.kind === "self_model" || cluster.count < 2) continue;
    const diameter = Math.max(0.72, Math.min(3.2, 0.66 + Math.sqrt(cluster.count) * 0.25));
    const mesh = MeshBuilder.CreateSphere(`os-v4-cluster:${cluster.kind}`, { diameter, segments: 12 }, scene);
    mesh.position.copyFrom(cluster.center);
    mesh.isPickable = false;
    const material = new StandardMaterial(`os-v4-cluster-material:${cluster.kind}`, scene);
    const energy = parseHex(semanticHex(cluster.kind));
    material.emissiveColor = energy.scale(0.62);
    material.diffuseColor = energy.scale(0.06);
    material.wireframe = true;
    material.alpha = 0.28;
    mesh.material = material;
    resources.push(mesh, material);
    clusters.push(mesh);
    clusterLabels.push(createLabel(scene, resources, `${cluster.kind.replaceAll("_", " ").toUpperCase()} · ${cluster.count}`, cluster.center, energy, `cluster:${cluster.kind}`, 1, true));
  }

  const labels: Mesh[] = [];
  const labelByNodeId = new Map<string, Mesh>();
  for (const nodeId of plan.labelNodeIds) {
    const node = plan.nodeById.get(nodeId);
    const position = plan.positions.get(nodeId);
    if (!node || !position) continue;
    const label = createLabel(scene, resources, node.label, position, parseHex(semanticHex(node.kind)), `node:${node.id}`, clamp01(node.importance));
    labels.push(label);
    labelByNodeId.set(node.id, label);
  }

  const coreMaterial = new StandardMaterial("os-v4-core-material", scene);
  coreMaterial.emissiveColor = goldBright.scale(0.88);
  coreMaterial.diffuseColor = gold.scale(0.08);
  coreMaterial.alpha = 0.86;
  resources.push(coreMaterial);
  const coreRings: Mesh[] = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = MeshBuilder.CreateTorus(`os-v4-core-ring:${index}`, { diameter: 1.9 + index * 0.58, thickness: 0.018 + index * 0.008, tessellation: 72 }, scene);
    ring.material = coreMaterial;
    ring.isPickable = false;
    ring.rotation.x = Math.PI / 2 + index * 0.54;
    ring.rotation.y = index * 0.72;
    resources.push(ring);
    coreRings.push(ring);
  }

  const focusHalo = MeshBuilder.CreateTorus("os-v4-focus-halo", { diameter: 1.4, thickness: 0.028, tessellation: 64 }, scene);
  focusHalo.material = coreMaterial;
  focusHalo.rotation.x = Math.PI / 2;
  focusHalo.isPickable = false;
  focusHalo.isVisible = false;
  resources.push(focusHalo);

  return {
    plan,
    resources,
    traceResources: [],
    labels,
    labelByNodeId,
    clusters,
    clusterLabels,
    coreRings,
    focusHalo,
    traceSystem: null,
    traceRoutes: [],
  };
}

function disposeTrace(layer: VisualLayer | null) {
  if (!layer) return;
  for (const resource of layer.traceResources) {
    try { resource.dispose(); } catch { /* defensive Babylon teardown */ }
  }
  layer.traceResources = [];
  layer.traceSystem = null;
  layer.traceRoutes = [];
}

function refreshTrace(scene: Scene, layer: VisualLayer, phase: CognitiveActivityPhase | null, settings: OsSettings) {
  disposeTrace(layer);
  if (!phase) return;
  const theme = getTheme(settings.themeId);
  const gold = parseHex(theme.gold);
  const goldBright = parseHex(theme.goldBright);
  const routes = layer.plan.visibleEdges
    .filter((edge) => edgeParticipates(edge, layer.plan.nodeById, phase))
    .slice(0, MAX_TRACE_PACKETS)
    .flatMap((edge) => {
      const from = layer.plan.positions.get(edge.from);
      const to = layer.plan.positions.get(edge.to);
      return from && to ? [{ from: from.clone(), to: to.clone(), offset: hashUnit(edge.id) }] : [];
    });
  if (routes.length === 0) return;

  const shape = MeshBuilder.CreateSphere("os-v4-trace-shape", { diameter: 0.11, segments: 5 }, scene);
  shape.isVisible = false;
  const system = new SolidParticleSystem("os-v4-trace-sps", scene, { isPickable: false });
  system.addShape(shape, routes.length);
  shape.dispose();
  system.buildMesh();
  system.computeParticleRotation = false;
  system.computeParticleColor = true;
  routes.forEach((route, index) => {
    const particle = system.particles[index];
    particle.position.copyFrom(route.from);
    particle.color = new Color4(goldBright.r, goldBright.g, goldBright.b, 0.96);
  });
  system.setParticles();
  const mesh = system.mesh;
  if (mesh) {
    mesh.hasVertexAlpha = true;
    const material = new StandardMaterial("os-v4-trace-material", scene);
    material.emissiveColor = goldBright;
    material.diffuseColor = gold.scale(0.1);
    material.alpha = 0.96;
    mesh.material = material;
    layer.traceResources.push(material);
  }
  layer.traceResources.push(system);
  layer.traceSystem = system;
  layer.traceRoutes = routes;
}

function disposeVisualLayer(layer: VisualLayer | null) {
  if (!layer) return;
  disposeTrace(layer);
  for (const resource of layer.resources) {
    try { resource.dispose(); } catch { /* defensive Babylon teardown */ }
  }
}

function pointSize(settings: OsSettings) {
  if (settings.renderQuality === "ULTRA") return 3.2;
  if (settings.renderQuality === "HIGH") return 2.8;
  if (settings.renderQuality === "MEDIUM") return 2.35;
  return 1.9;
}

export default function SpatialRendererV4(props: Props) {
  const { graph, activity, phase, workspaceId, settings, selectedNodeId, onSelectNode } = props;
  const initiallyLegacy = typeof navigator === "undefined" || !("gpu" in navigator);
  const [legacyMode, setLegacyMode] = useState(initiallyLegacy);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGPUEngine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const cameraDirectorRef = useRef<CameraDirector | null>(null);
  const glowRef = useRef<GlowLayer | null>(null);
  const gpuGraphRef = useRef<GpuGraphField | null>(null);
  const signalFieldRef = useRef<GpuSignalField | null>(null);
  const visualLayerRef = useRef<VisualLayer | null>(null);
  const settingsRef = useRef(settings);
  const workspaceIdRef = useRef(workspaceId);
  const phaseRef = useRef(phase);
  const activityRef = useRef(activity);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const onSelectNodeRef = useRef(onSelectNode);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const hoverNodeIdRef = useRef<string | null>(null);
  const lastAdaptRef = useRef(0);
  const lastRenderRef = useRef(0);
  const lastTelemetryRef = useRef(0);
  const effectiveScaleRef = useRef(RENDER_PROFILES[settings.renderQuality].resolutionScale);

  const plan = useMemo(() => buildProjectionPlan(graph, workspaceId, settings), [graph, workspaceId, settings.renderQuality, settings.graphDensity, settings.labelDensity, settings.ambientParticles]);
  const planRef = useRef(plan);
  planRef.current = plan;
  settingsRef.current = settings;
  workspaceIdRef.current = workspaceId;
  phaseRef.current = phase;
  activityRef.current = activity;
  selectedNodeIdRef.current = selectedNodeId;
  onSelectNodeRef.current = onSelectNode;

  const [zoomLevel, setZoomLevel] = useState<SemanticZoomLevel>("network");
  const zoomLevelRef = useRef<SemanticZoomLevel>("network");
  const [cameraMode, setCameraMode] = useState<CameraMode>(workspaceById(workspaceId).preferredCamera);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
  const [measuredFps, setMeasuredFps] = useState(0);
  const [effectiveScale, setEffectiveScale] = useState(effectiveScaleRef.current);
  const [gpuSignals, setGpuSignals] = useState(0);
  const [gpuNodesCount, setGpuNodesCount] = useState(0);
  const [gpuEdgesCount, setGpuEdgesCount] = useState(0);
  const [rebuildCount, setRebuildCount] = useState(0);
  const [mutableCount, setMutableCount] = useState(0);
  const activeWorkspace = useMemo(() => workspaceById(workspaceId), [workspaceId]);

  const rebuildSignalField = () => {
    signalFieldRef.current?.dispose();
    signalFieldRef.current = null;
    setGpuSignals(0);
    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene || !GpuSignalField.supported(engine)) return;
    const profile = RENDER_PROFILES[settingsRef.current.renderQuality];
    const count = resolveGpuSignalBudget(profile, settingsRef.current.ambientParticles, true);
    if (count <= 0) return;
    const theme = getTheme(settingsRef.current.themeId);
    signalFieldRef.current = new GpuSignalField(engine, scene, {
      count,
      radius: workspaceById(workspaceIdRef.current).cameraRadius * 1.55,
      vertical: Math.max(10, workspaceById(workspaceIdRef.current).cameraRadius * 0.82),
      gold: parseHex(theme.gold),
      pointSize: settingsRef.current.renderQuality === "ULTRA" ? 1.55 : settingsRef.current.renderQuality === "HIGH" ? 1.35 : 1.1,
    });
    setGpuSignals(count);
  };

  const rebuildProjection = () => {
    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene) return;
    const currentPlan = planRef.current;
    const currentSettings = settingsRef.current;

    gpuGraphRef.current?.dispose();
    gpuGraphRef.current = null;
    disposeVisualLayer(visualLayerRef.current);
    visualLayerRef.current = null;

    try {
      const graphField = new GpuGraphField(engine, scene, {
        nodes: gpuNodes(currentPlan),
        edges: gpuEdges(currentPlan, currentSettings),
        pointSize: pointSize(currentSettings),
        distanceMultiplier: 2.35,
      });
      gpuGraphRef.current = graphField;
      setGpuNodesCount(graphField.nodeCount);
      setGpuEdgesCount(graphField.edgeCount);
      const layer = createVisualLayer(scene, currentPlan, currentSettings);
      visualLayerRef.current = layer;
      refreshTrace(scene, layer, phaseRef.current, currentSettings);
      setRebuildCount((count) => count + 1);
    } catch (error) {
      console.warn("OS SpatialRendererV4: GPU graph initialization failed, activating Phase 3 fallback.", error);
      setLegacyMode(true);
    }
  };

  const updateMutable = () => {
    const layer = visualLayerRef.current;
    const graphField = gpuGraphRef.current;
    const currentPlan = planRef.current;
    if (!layer || !graphField || layer.plan.key !== currentPlan.key) return;
    const updated = graphField.updateMutable(gpuNodes(currentPlan), gpuEdges(currentPlan, settingsRef.current));
    if (!updated) {
      rebuildProjection();
      return;
    }
    layer.plan = currentPlan;
    for (const nodeId of currentPlan.labelNodeIds) {
      const label = layer.labelByNodeId.get(nodeId);
      const node = currentPlan.nodeById.get(nodeId);
      if (label?.metadata && node) label.metadata.importance = clamp01(node.importance);
    }
    setMutableCount((count) => count + 1);
  };

  const pickNode = () => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const layer = visualLayerRef.current;
    if (!scene || !camera || !layer) return null;
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera);
    const hit = layer.plan.pickIndex.pick(ray, camera.upperRadiusLimit ?? 1000);
    return hit ? layer.plan.nodeById.get(hit.id) ?? null : null;
  };

  const applyHover = (node: CognitiveNode | null) => {
    const canvas = canvasRef.current;
    const layer = visualLayerRef.current;
    if (!canvas || !layer) return;
    if (!node) {
      hoverNodeIdRef.current = null;
      canvas.style.cursor = "default";
      setHoverInfo(null);
      if (!selectedNodeIdRef.current) layer.focusHalo.isVisible = false;
      return;
    }
    hoverNodeIdRef.current = node.id;
    canvas.style.cursor = "pointer";
    setHoverInfo({ id: node.id, label: node.label, kind: node.kind, importance: node.importance, confidence: node.confidence });
    if (!selectedNodeIdRef.current) {
      const position = layer.plan.positions.get(node.id);
      if (position) {
        layer.focusHalo.position.copyFrom(position);
        layer.focusHalo.scaling.setAll(Math.max(0.68, (layer.plan.sizes.get(node.id) ?? 0.4) * 1.55));
        layer.focusHalo.isVisible = true;
      }
    }
  };

  useEffect(() => {
    if (legacyMode) return;
    rebuildProjection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.key, settings.renderQuality, settings.themeId, settings.edgeIntensity]);

  useEffect(() => {
    if (legacyMode) return;
    const layer = visualLayerRef.current;
    if (layer?.plan.key === plan.key) updateMutable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  useEffect(() => {
    if (legacyMode) return;
    const scene = sceneRef.current;
    const layer = visualLayerRef.current;
    if (scene && layer) refreshTrace(scene, layer, phase, settingsRef.current);
  }, [phase, legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    rebuildSignalField();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.renderQuality, settings.themeId, settings.ambientParticles, workspaceId, legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    const scene = sceneRef.current;
    if (scene) {
      const theme = getTheme(settings.themeId);
      const canvasColor = parseHex(theme.canvas);
      scene.clearColor = new Color4(canvasColor.r, canvasColor.g, canvasColor.b, 1);
      scene.fogColor = canvasColor;
      scene.fogDensity = activeWorkspace.fogDensity * settings.depthFog;
    }
    const profile = RENDER_PROFILES[settings.renderQuality];
    if (glowRef.current) glowRef.current.intensity = settings.glowIntensity * profile.bloomScale;
  }, [activeWorkspace, settings.depthFog, settings.glowIntensity, settings.renderQuality, settings.themeId, legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    const director = cameraDirectorRef.current;
    if (!director) return;
    director.setWorkspace(activeWorkspace);
    setCameraMode(activeWorkspace.preferredCamera);
  }, [activeWorkspace, legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    const layer = visualLayerRef.current;
    const director = cameraDirectorRef.current;
    if (!layer) return;
    if (!selectedNodeId) {
      layer.focusHalo.isVisible = false;
      if (director?.currentMode === "FOCUS") {
        director.setMode(activeWorkspace.preferredCamera, activeWorkspace);
        setCameraMode(activeWorkspace.preferredCamera);
      }
      return;
    }
    const position = layer.plan.positions.get(selectedNodeId);
    if (!position) return;
    const focusRadius = Math.max(4.2, Math.min(7.5, activeWorkspace.cameraRadius * 0.34));
    director?.focus(position, focusRadius);
    setCameraMode("FOCUS");
    layer.focusHalo.position.copyFrom(position);
    layer.focusHalo.scaling.setAll(Math.max(0.72, (layer.plan.sizes.get(selectedNodeId) ?? 0.4) * 1.7));
    layer.focusHalo.isVisible = true;
  }, [selectedNodeId, activeWorkspace, legacyMode]);

  useEffect(() => {
    if (legacyMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let pointerObserver: ReturnType<Scene["onPointerObservable"]["add"]> | null = null;
    const resize = () => engineRef.current?.resize();

    void (async () => {
      try {
        const profile = RENDER_PROFILES[settingsRef.current.renderQuality];
        const engine = new WebGPUEngine(canvas, { antialias: profile.antialiasing !== "none", adaptToDeviceRatio: true });
        await engine.initAsync();
        if (disposed) {
          engine.dispose();
          return;
        }
        if (!GpuGraphField.supported(engine)) {
          engine.dispose();
          setLegacyMode(true);
          return;
        }

        engine.setHardwareScalingLevel(1 / profile.resolutionScale);
        engineRef.current = engine;
        const scene = new Scene(engine);
        sceneRef.current = scene;
        const theme = getTheme(settingsRef.current.themeId);
        const canvasColor = parseHex(theme.canvas);
        scene.clearColor = new Color4(canvasColor.r, canvasColor.g, canvasColor.b, 1);
        scene.fogMode = Scene.FOGMODE_EXP2;
        scene.fogColor = canvasColor;
        scene.fogDensity = workspaceById(workspaceIdRef.current).fogDensity * settingsRef.current.depthFog;

        const workspace = workspaceById(workspaceIdRef.current);
        const camera = new ArcRotateCamera("os-spatial-v4-camera", -Math.PI / 2, Math.PI / 2.34, workspace.cameraRadius, Vector3.Zero(), scene);
        cameraRef.current = camera;
        camera.lowerRadiusLimit = 2.8;
        camera.upperRadiusLimit = 90;
        camera.lowerBetaLimit = 0.18;
        camera.upperBetaLimit = Math.PI - 0.18;
        camera.wheelPrecision = 22;
        camera.panningSensibility = 105;
        camera.inertia = 0.84;
        camera.attachControl(canvas, true);
        cameraDirectorRef.current = new CameraDirector(workspace);
        setCameraMode(workspace.preferredCamera);

        const light = new HemisphericLight("os-v4-ambient-light", new Vector3(0.2, 1, 0.15), scene);
        light.intensity = 0.34;
        light.diffuse = parseHex(theme.goldSoft);
        light.groundColor = parseHex(theme.canvas);
        const glow = new GlowLayer("os-v4-gold-bloom", scene, { blurKernelSize: 38 });
        glowRef.current = glow;
        glow.intensity = settingsRef.current.glowIntensity * profile.bloomScale;

        rebuildProjection();
        rebuildSignalField();
        if (legacyMode) return;

        pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
          if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
            applyHover(pickNode());
            return;
          }
          if (pointerInfo.type === PointerEventTypes.POINTERWHEEL) {
            cameraDirectorRef.current?.userControl();
            setCameraMode("FREE");
            return;
          }
          if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            pointerDownRef.current = { x: scene.pointerX, y: scene.pointerY };
            cameraDirectorRef.current?.userControl();
            setCameraMode("FREE");
            return;
          }
          if (pointerInfo.type !== PointerEventTypes.POINTERUP) return;
          const pressed = pointerDownRef.current;
          pointerDownRef.current = null;
          if (!pressed || Math.hypot(scene.pointerX - pressed.x, scene.pointerY - pressed.y) > 6) return;
          const node = pickNode();
          if (node) {
            const layer = visualLayerRef.current;
            const position = layer?.plan.positions.get(node.id);
            if (position) {
              cameraDirectorRef.current?.focus(position, Math.max(4.2, Math.min(7.5, workspaceById(workspaceIdRef.current).cameraRadius * 0.34)));
              setCameraMode("FOCUS");
            }
            onSelectNodeRef.current(node);
          } else {
            onSelectNodeRef.current(null);
            const currentWorkspace = workspaceById(workspaceIdRef.current);
            cameraDirectorRef.current?.overview(currentWorkspace);
            setCameraMode("OVERVIEW");
          }
        });

        scene.onBeforeRenderObservable.add(() => {
          const now = performance.now();
          const currentSettings = settingsRef.current;
          const frameInterval = 1000 / currentSettings.targetFps;
          if (now - lastRenderRef.current < frameInterval * 0.82) return;
          lastRenderRef.current = now;
          const time = now * 0.001;
          const motion = currentSettings.reducedMotion ? 0 : currentSettings.animationIntensity;
          const currentWorkspace = workspaceById(workspaceIdRef.current);
          const nextZoom = semanticZoom(camera.radius);
          if (nextZoom !== zoomLevelRef.current) {
            zoomLevelRef.current = nextZoom;
            setZoomLevel(nextZoom);
          }

          cameraDirectorRef.current?.tick(camera, currentWorkspace, time, motion, currentSettings.reducedMotion, activityRef.current);
          const showEdges = nextZoom === "network" || nextZoom === "detail" || nextZoom === "inspect";
          gpuGraphRef.current?.setVisible(true, showEdges);
          gpuGraphRef.current?.tick(camera.target, camera.radius, nextZoom, selectedNodeIdRef.current, time, motion, showEdges);
          const signal = signalFieldRef.current;
          if (signal) {
            signal.setVisible(nextZoom !== "inspect" && currentSettings.ambientParticles > 0.02);
            signal.tick(currentSettings.reducedMotion ? 0 : time, activityRef.current, motion, workspaceIdRef.current);
          }

          const layer = visualLayerRef.current;
          if (layer) {
            const showClusters = nextZoom === "universe" || nextZoom === "cluster";
            for (const mesh of layer.clusters) mesh.isVisible = showClusters;
            for (const mesh of layer.clusterLabels) mesh.isVisible = showClusters;
            for (const mesh of layer.labels) {
              const importance = Number(mesh.metadata?.importance ?? 0);
              mesh.isVisible = nextZoom === "detail" || nextZoom === "inspect" || (nextZoom === "network" && importance >= 0.74);
            }
            layer.coreRings.forEach((ring, index) => {
              const direction = index % 2 === 0 ? 1 : -1;
              ring.rotation.z += direction * 0.0008 * motion;
              ring.rotation.y += direction * 0.00045 * motion;
              ring.scaling.setAll(1 + Math.sin(time * (1.2 + index * 0.22) + activityRef.current * 0.18) * 0.025 * Math.max(0.2, motion));
            });
            if (layer.focusHalo.isVisible) {
              layer.focusHalo.rotation.z += 0.0035 * Math.max(0.25, motion);
              const base = selectedNodeIdRef.current
                ? Math.max(0.72, (layer.plan.sizes.get(selectedNodeIdRef.current) ?? 0.4) * 1.7)
                : Math.max(0.68, (layer.plan.sizes.get(hoverNodeIdRef.current ?? "") ?? 0.4) * 1.55);
              layer.focusHalo.scaling.setAll(base * (1 + Math.sin(time * 3.4) * 0.055 * Math.max(0.2, motion)));
            }
            if (layer.traceSystem && layer.traceRoutes.length > 0 && motion > 0) {
              layer.traceRoutes.forEach((route, index) => {
                const particle = layer.traceSystem?.particles[index];
                if (!particle) return;
                Vector3.LerpToRef(route.from, route.to, (time * (0.38 + motion * 0.24) + route.offset) % 1, particle.position);
              });
              layer.traceSystem.setParticles();
            }
          }

          if (currentSettings.adaptiveQuality && now - lastAdaptRef.current > 1600) {
            lastAdaptRef.current = now;
            const activeProfile = RENDER_PROFILES[currentSettings.renderQuality];
            const nextScale = adaptiveResolutionScale({
              requestedScale: activeProfile.resolutionScale,
              effectiveScale: effectiveScaleRef.current,
              targetFps: currentSettings.targetFps,
              measuredFps: engine.getFps(),
            }, activeProfile);
            if (Math.abs(nextScale - effectiveScaleRef.current) >= 0.015) {
              effectiveScaleRef.current = nextScale;
              engine.setHardwareScalingLevel(1 / nextScale);
              setEffectiveScale(nextScale);
            }
          }
          if (now - lastTelemetryRef.current > 1000) {
            lastTelemetryRef.current = now;
            setMeasuredFps(Math.round(engine.getFps()));
          }
        });

        engine.runRenderLoop(() => scene.render());
        window.addEventListener("resize", resize);
      } catch (error) {
        console.warn("OS SpatialRendererV4: WebGPU initialization failed, activating Phase 3 fallback.", error);
        setLegacyMode(true);
      }
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      const scene = sceneRef.current;
      if (scene && pointerObserver) scene.onPointerObservable.remove(pointerObserver);
      gpuGraphRef.current?.dispose();
      gpuGraphRef.current = null;
      signalFieldRef.current?.dispose();
      signalFieldRef.current = null;
      disposeVisualLayer(visualLayerRef.current);
      visualLayerRef.current = null;
      glowRef.current?.dispose();
      glowRef.current = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      cameraRef.current = null;
      cameraDirectorRef.current = null;
    };
  }, [legacyMode]);

  const selectCameraMode = (mode: CameraMode) => {
    const director = cameraDirectorRef.current;
    if (!director) return;
    const workspace = workspaceById(workspaceIdRef.current);
    const layer = visualLayerRef.current;
    const selectedPosition = selectedNodeIdRef.current ? layer?.plan.positions.get(selectedNodeIdRef.current) : null;
    const focusRadius = Math.max(4.2, Math.min(7.5, workspace.cameraRadius * 0.34));
    if (mode === "OVERVIEW") {
      director.overview(workspace);
      onSelectNodeRef.current(null);
    } else if (mode === "FOCUS" && selectedPosition) {
      director.focus(selectedPosition, focusRadius);
    } else if (mode === "FOLLOW" && selectedPosition) {
      director.follow(selectedPosition, Math.max(6.2, focusRadius * 1.34));
    } else if (mode === "FREE") {
      director.userControl();
    } else {
      director.setMode(mode, workspace);
    }
    setCameraMode(mode);
  };

  if (legacyMode) return <LegacySpatialRenderer {...props} />;

  return (
    <>
      <canvas ref={canvasRef} className="void-canvas" aria-label="OS GPU-resident spatial cognition renderer" />
      <div className={`spatial-navigator${selectedNodeId ? " node-selected" : ""}`}>
        <div className="spatial-level"><span>SEMANTIC LOD</span><strong>{zoomLevel.toUpperCase()}</strong></div>
        <div className="spatial-cluster">
          <span>GPU GRAPH</span>
          <strong>COMPUTE / BVH</strong>
          <small>{gpuNodesCount.toLocaleString()} N · {gpuEdgesCount.toLocaleString()} E · {gpuSignals.toLocaleString()} SIG · {plan.pickIndex.count.toLocaleString()} PICK · {effectiveScale.toFixed(2)}× · {measuredFps} FPS · R{rebuildCount}/Δ{mutableCount}</small>
        </div>
        <div className="camera-mode-strip" aria-label="Spatial camera mode">
          {CAMERA_MODES.map((mode) => (
            <button type="button" key={mode} className={cameraMode === mode ? "active" : ""} onClick={() => selectCameraMode(mode)} title={`${mode} camera mode`}>
              {mode.slice(0, 3)}
            </button>
          ))}
        </div>
        {selectedNodeId && <button type="button" className="spatial-overview-button" onClick={() => selectCameraMode("OVERVIEW")}>OVERVIEW</button>}
      </div>
      {hoverInfo && (
        <div className="spatial-hover-readout">
          <span>{hoverInfo.kind.replaceAll("_", " ")}</span>
          <strong>{hoverInfo.label}</strong>
          <small>importance {Math.round(hoverInfo.importance * 100)}% · confidence {Math.round(hoverInfo.confidence * 100)}%</small>
        </div>
      )}
    </>
  );
}
