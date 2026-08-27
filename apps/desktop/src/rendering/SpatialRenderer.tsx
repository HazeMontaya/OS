import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceId } from "@os/protocol";
import { getTheme, OS_SEMANTIC_GOLD } from "@os/design-system";
import {
  adaptiveResolutionScale,
  describeGpuPipeline,
  RENDER_PROFILES,
  resolveRenderBudget,
  type GpuFeatureTier,
  type RenderBackend,
} from "@os/renderer";
import {
  workspaceById,
  type CameraMode,
  type SemanticZoomLevel,
  type SpatialLayoutMode,
} from "@os/visualization";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SolidParticleSystem } from "@babylonjs/core/Particles/solidParticleSystem";
import { Scene } from "@babylonjs/core/scene";
import type {
  CognitiveActivityPhase,
  CognitiveEdge,
  CognitiveNode,
  GraphSnapshot,
} from "../cognitive";
import type { OsSettings } from "../settings/useOsSettings";
import { CameraDirector } from "./CameraDirector";
import { GpuSignalField } from "./GpuSignalField";

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

type TraceRoute = {
  from: Vector3;
  to: Vector3;
  offset: number;
};

type VisualProjection = {
  root: TransformNode;
  resources: Array<{ dispose: () => void }>;
  positions: Map<string, Vector3>;
  sizes: Map<string, number>;
  nodeById: Map<string, CognitiveNode>;
  labels: Mesh[];
  clusterMeshes: Mesh[];
  clusterLabels: Mesh[];
  edgeMeshes: Mesh[];
  pickMeshes: Mesh[];
  nodeMesh: Mesh | null;
  ambientMesh: Mesh | null;
  traceMesh: Mesh | null;
  traceSystem: SolidParticleSystem | null;
  traceRoutes: TraceRoute[];
  coreRings: Mesh[];
  focusHalo: Mesh;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_AMBIENT_SIGNALS = 900;
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

function semanticColor(kind: string, alpha = 1) {
  const color = parseHex(semanticHex(kind));
  return new Color4(color.r, color.g, color.b, alpha);
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
    case "semantic_memory": return 11.0;
    case "stable_memory": return 12.2;
    case "agent": return 8.4;
    case "model": return 10.0;
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
  const radialJitter = (hashUnit(`${node.id}:knowledge-r`) - 0.5) * 2.2;
  const radius = shell + radialJitter;
  return new Vector3(
    Math.cos(angle) * planar * radius,
    yUnit * radius * 0.82,
    Math.sin(angle) * planar * radius,
  );
}

function temporalHelixPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const memoryBand = node.kind === "stable_memory" ? 3 : node.kind === "semantic_memory" ? 2 : node.kind === "episodic_memory" ? 1 : 0;
  const angle = localIndex * 0.57 + hashUnit(`${node.id}:memory-a`) * 1.4;
  const radius = 7.2 + memoryBand * 2.25 + hashUnit(`${node.id}:memory-r`) * 1.6;
  const layer = (localIndex % 41) - 20;
  const y = layer * 0.42 + memoryBand * 0.72 + (hashUnit(`${node.id}:memory-y`) - 0.5) * 0.7;
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function executionOrbitPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const orbit = node.kind === "agent" ? 5.2
    : node.kind === "model" ? 8.1
      : node.kind === "tool" ? 11.2
        : node.kind === "goal" ? 13.8
          : node.kind === "project" ? 15.8
            : 9.5;
  const angle = localIndex * GOLDEN_ANGLE + hashUnit(`${node.id}:agent-a`) * Math.PI * 2;
  const tilt = (hashUnit(`${node.id}:agent-y`) - 0.5) * 2.7;
  const wobble = (hashUnit(`${node.id}:agent-r`) - 0.5) * 1.2;
  return new Vector3(Math.cos(angle) * (orbit + wobble), tilt, Math.sin(angle) * (orbit + wobble));
}

function traceMatrixPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const lane = kindLane(node.kind);
  const row = localIndex % 23;
  const deck = Math.floor(localIndex / 23);
  return new Vector3(
    lane * 3.3 + (hashUnit(`${node.id}:trace-x`) - 0.5) * 0.7,
    (deck - 2) * 1.45 + (hashUnit(`${node.id}:trace-y`) - 0.5) * 0.55,
    (row - 11) * 1.18,
  );
}

function systemRingPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const ringIndex = Math.abs(kindLane(node.kind));
  const radius = 6.2 + ringIndex * 2.15 + hashUnit(`${node.id}:system-r`) * 1.1;
  const angle = localIndex * GOLDEN_ANGLE + ringIndex * 0.42 + hashUnit(`${node.id}:system-a`) * 0.6;
  const y = (kindLane(node.kind) * 0.65) + (hashUnit(`${node.id}:system-y`) - 0.5) * 0.65;
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function automationCircuitPosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const lane = kindLane(node.kind);
  const row = localIndex % 19;
  const deck = Math.floor(localIndex / 19);
  const x = lane * 3.4;
  const z = (row - 9) * 1.4 + Math.sin((row / 18) * Math.PI) * lane * 0.16;
  const y = (deck - 1.5) * 1.1 + (hashUnit(`${node.id}:auto-y`) - 0.5) * 0.45;
  return new Vector3(x, y, z);
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
    case "COGNITIVE_CONSTELLATION":
    default:
      return constellationPosition(node, localIndex, workspaceId);
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

function edgeParticipates(edge: CognitiveEdge, nodeById: Map<string, CognitiveNode>, phase: CognitiveActivityPhase | null) {
  if (!phase || edge.valid_until_ms !== null) return false;
  const from = nodeById.get(edge.from)?.kind ?? "";
  const to = nodeById.get(edge.to)?.kind ?? "";
  if (phase === "memory_recall") return from.includes("memory") || to.includes("memory");
  if (phase === "model_inference") return [from, to].some((kind) => kind === "model" || kind === "self_model" || kind === "agent");
  if (phase === "output_persist") return [from, to].some((kind) => kind === "self_model" || kind === "model" || kind === "episodic_memory");
  return false;
}

async function createEngine(canvas: HTMLCanvasElement, settings: OsSettings): Promise<{ engine: AbstractEngine; backend: RenderBackend }> {
  const profile = RENDER_PROFILES[settings.renderQuality];
  const antialias = profile.antialiasing !== "none";
  if ("gpu" in navigator) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias, adaptToDeviceRatio: true });
      await engine.initAsync();
      engine.setHardwareScalingLevel(1 / profile.resolutionScale);
      return { engine, backend: "WEBGPU" };
    } catch (error) {
      console.warn("OS SpatialRenderer: WebGPU unavailable, falling back to WebGL.", error);
    }
  }
  const engine = new Engine(canvas, antialias, { preserveDrawingBuffer: false, stencil: true }, true);
  engine.setHardwareScalingLevel(1 / profile.resolutionScale);
  return { engine, backend: "WEBGL" };
}

function createLabel(
  scene: Scene,
  root: TransformNode,
  resources: Array<{ dispose: () => void }>,
  text: string,
  position: Vector3,
  color: Color3,
  id: string,
  importance: number,
  ownerType: "node" | "cluster",
) {
  const display = text.length > 42 ? `${text.slice(0, 39)}…` : text;
  const width = Math.max(1.5, Math.min(5.6, display.length * 0.105));
  const texture = new DynamicTexture(`os-label-texture:${id}`, { width: 768, height: 112 }, scene, false);
  texture.hasAlpha = true;
  texture.drawText(
    display,
    null,
    72,
    ownerType === "cluster" ? "600 34px Segoe UI" : "500 29px Segoe UI",
    ownerType === "cluster" ? "#fff0c2" : "#e9d9ad",
    "transparent",
    true,
    true,
  );

  const material = new StandardMaterial(`os-label-material:${id}`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = color.scale(ownerType === "cluster" ? 0.9 : 0.68);
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = ownerType === "cluster" ? 0.92 : 0.82;

  const plane = MeshBuilder.CreatePlane(`os-label:${id}`, { width, height: ownerType === "cluster" ? 0.5 : 0.4 }, scene);
  plane.parent = root;
  plane.position.copyFrom(position);
  plane.position.y += ownerType === "cluster" ? 1.05 : 0.58;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.material = material;
  plane.isPickable = false;
  plane.renderingGroupId = 2;
  plane.metadata = { osLabel: true, ownerType, importance };

  resources.push(texture, material);
  return plane;
}

function makeProjection(
  scene: Scene,
  graph: GraphSnapshot,
  workspaceId: WorkspaceId,
  settings: OsSettings,
  phase: CognitiveActivityPhase | null,
): VisualProjection {
  const profile = RENDER_PROFILES[settings.renderQuality];
  const budget = resolveRenderBudget(profile, settings.graphDensity, settings.labelDensity, settings.ambientParticles);
  const theme = getTheme(settings.themeId);
  const gold = parseHex(theme.gold);
  const goldBright = parseHex(theme.goldBright);
  const bronze = parseHex(theme.bronze);
  const root = new TransformNode("os-spatial-projection", scene);
  const resources: Array<{ dispose: () => void }> = [];

  const visibleNodes = graph.nodes
    .filter((node) => workspaceAllows(node, workspaceId))
    .sort((left, right) => nodePriority(right, workspaceId) - nodePriority(left, workspaceId) || left.id.localeCompare(right.id))
    .slice(0, budget.nodes);

  const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
  const visibleIds = new Set(nodeById.keys());
  const kindIndexes = new Map<string, number>();
  const positions = new Map<string, Vector3>();
  const sizes = new Map<string, number>();
  const clusters = new Map<string, { nodes: CognitiveNode[]; center: Vector3 }>();

  for (const node of visibleNodes) {
    const localIndex = kindIndexes.get(node.kind) ?? 0;
    kindIndexes.set(node.kind, localIndex + 1);
    const position = nodePosition(node, localIndex, workspaceId);
    const size = nodeVisualSize(node);
    positions.set(node.id, position);
    sizes.set(node.id, size);
    const cluster = clusters.get(node.kind) ?? { nodes: [], center: Vector3.Zero() };
    cluster.nodes.push(node);
    cluster.center.addInPlace(position);
    clusters.set(node.kind, cluster);
  }
  for (const cluster of clusters.values()) cluster.center.scaleInPlace(1 / Math.max(1, cluster.nodes.length));

  const nodeSphere = MeshBuilder.CreateSphere("os-node-shape", { diameter: 1, segments: profile.sphereSegments }, scene);
  nodeSphere.isVisible = false;
  const nodeSystem = new SolidParticleSystem("os-node-sps", scene, { isPickable: false });
  nodeSystem.addShape(nodeSphere, visibleNodes.length);
  nodeSphere.dispose();
  nodeSystem.buildMesh();
  nodeSystem.computeParticleColor = true;
  nodeSystem.computeParticleRotation = false;
  nodeSystem.computeParticleTexture = false;

  visibleNodes.forEach((node, index) => {
    const particle = nodeSystem.particles[index];
    const position = positions.get(node.id) ?? Vector3.Zero();
    const size = sizes.get(node.id) ?? 0.3;
    particle.position.copyFrom(position);
    particle.scaling.setAll(size);
    const confidence = clamp01(node.confidence);
    particle.color = semanticColor(node.kind, 0.48 + confidence * 0.5);
  });
  nodeSystem.setParticles();

  const nodeMesh = nodeSystem.mesh;
  if (nodeMesh) {
    nodeMesh.parent = root;
    nodeMesh.isPickable = false;
    nodeMesh.hasVertexAlpha = true;
    nodeMesh.alwaysSelectAsActiveMesh = true;
    const material = new StandardMaterial("os-node-material", scene);
    material.diffuseColor = new Color3(0.42, 0.34, 0.18);
    material.emissiveColor = gold.scale(0.55);
    material.specularColor = goldBright.scale(0.22);
    material.alpha = 0.96;
    nodeMesh.material = material;
    resources.push(material);
  }
  resources.push(nodeSystem);

  const currentLines: Vector3[][] = [];
  const historicalLines: Vector3[][] = [];
  const visibleEdges = graph.edges
    .filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to))
    .sort((left, right) => {
      const leftActive = edgeParticipates(left, nodeById, phase) ? 1 : 0;
      const rightActive = edgeParticipates(right, nodeById, phase) ? 1 : 0;
      return rightActive - leftActive || right.weight - left.weight;
    })
    .slice(0, budget.edges);

  for (const edge of visibleEdges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    (edge.valid_until_ms === null ? currentLines : historicalLines).push([from, to]);
  }

  const edgeMeshes: Mesh[] = [];
  if (currentLines.length > 0) {
    const mesh = MeshBuilder.CreateLineSystem("os-relations-current", { lines: currentLines, updatable: false }, scene);
    mesh.parent = root;
    mesh.color = gold;
    mesh.alpha = Math.min(0.58, 0.11 + settings.edgeIntensity * 0.24);
    mesh.isPickable = false;
    edgeMeshes.push(mesh);
  }
  if (historicalLines.length > 0) {
    const mesh = MeshBuilder.CreateLineSystem("os-relations-history", { lines: historicalLines, updatable: false }, scene);
    mesh.parent = root;
    mesh.color = bronze;
    mesh.alpha = Math.min(0.2, 0.035 + settings.edgeIntensity * 0.075);
    mesh.isPickable = false;
    edgeMeshes.push(mesh);
  }

  const clusterMeshes: Mesh[] = [];
  const clusterLabels: Mesh[] = [];
  for (const [kind, cluster] of clusters) {
    if (kind === "self_model" || cluster.nodes.length < 2) continue;
    const diameter = Math.max(0.72, Math.min(3.2, 0.66 + Math.sqrt(cluster.nodes.length) * 0.25));
    const mesh = MeshBuilder.CreateSphere(`os-cluster:${kind}`, { diameter, segments: 12 }, scene);
    mesh.parent = root;
    mesh.position.copyFrom(cluster.center);
    mesh.isPickable = false;
    const material = new StandardMaterial(`os-cluster-material:${kind}`, scene);
    const energy = parseHex(semanticHex(kind));
    material.emissiveColor = energy.scale(0.62);
    material.diffuseColor = energy.scale(0.06);
    material.wireframe = true;
    material.alpha = 0.28;
    mesh.material = material;
    resources.push(material);
    clusterMeshes.push(mesh);
    clusterLabels.push(createLabel(scene, root, resources, `${kind.replaceAll("_", " ").toUpperCase()} · ${cluster.nodes.length}`, cluster.center, energy, `cluster:${kind}`, 1, "cluster"));
  }

  const labels: Mesh[] = [];
  const labelNodes = visibleNodes
    .filter((node) => node.kind !== "self_model")
    .sort((left, right) => nodePriority(right, workspaceId) - nodePriority(left, workspaceId))
    .slice(0, budget.labels);
  for (const node of labelNodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    labels.push(createLabel(scene, root, resources, node.label, position, parseHex(semanticHex(node.kind)), `node:${node.id}`, clamp01(node.importance), "node"));
  }

  const pickMeshes: Mesh[] = [];
  const pickMaterial = new StandardMaterial("os-pick-material", scene);
  pickMaterial.alpha = 0;
  pickMaterial.disableLighting = true;
  resources.push(pickMaterial);
  for (const node of visibleNodes.slice(0, budget.pickProxies)) {
    const position = positions.get(node.id);
    if (!position) continue;
    const size = sizes.get(node.id) ?? 0.3;
    const proxy = MeshBuilder.CreateSphere(`os-pick:${node.id}`, { diameter: Math.max(0.5, size * 2.5), segments: 6 }, scene);
    proxy.parent = root;
    proxy.position.copyFrom(position);
    proxy.material = pickMaterial;
    proxy.isPickable = true;
    proxy.metadata = { osPickNode: true, nodeId: node.id };
    pickMeshes.push(proxy);
  }

  const ambientCount = Math.min(MAX_AMBIENT_SIGNALS, budget.ambientSignals);
  let ambientMesh: Mesh | null = null;
  if (ambientCount > 0) {
    const ambientShape = MeshBuilder.CreateSphere("os-ambient-shape", { diameter: 0.035, segments: 3 }, scene);
    ambientShape.isVisible = false;
    const ambientSystem = new SolidParticleSystem("os-ambient-sps", scene, { isPickable: false });
    ambientSystem.addShape(ambientShape, ambientCount);
    ambientShape.dispose();
    ambientSystem.buildMesh();
    ambientSystem.computeParticleColor = true;
    ambientSystem.computeParticleRotation = false;
    for (let index = 0; index < ambientCount; index += 1) {
      const particle = ambientSystem.particles[index];
      const radius = 8 + hashUnit(`ambient:${workspaceId}:${index}:r`) * 34;
      const angle = hashUnit(`ambient:${workspaceId}:${index}:a`) * Math.PI * 2;
      const y = (hashUnit(`ambient:${workspaceId}:${index}:y`) - 0.5) * 18;
      particle.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const scale = 0.5 + hashUnit(`ambient:${index}:s`) * 1.7;
      particle.scaling.setAll(scale);
      particle.color = new Color4(gold.r, gold.g, gold.b, 0.035 + hashUnit(`ambient:${index}:c`) * 0.13);
    }
    ambientSystem.setParticles();
    ambientMesh = ambientSystem.mesh;
    if (ambientMesh) {
      ambientMesh.parent = root;
      ambientMesh.hasVertexAlpha = true;
      ambientMesh.alwaysSelectAsActiveMesh = true;
      const material = new StandardMaterial("os-ambient-material", scene);
      material.diffuseColor = gold.scale(0.18);
      material.emissiveColor = gold.scale(0.46);
      material.alpha = 0.68;
      ambientMesh.material = material;
      resources.push(material);
    }
    resources.push(ambientSystem);
  }

  const activeRoutes = visibleEdges
    .filter((edge) => edgeParticipates(edge, nodeById, phase))
    .slice(0, MAX_TRACE_PACKETS)
    .flatMap((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      return from && to ? [{ from: from.clone(), to: to.clone(), offset: hashUnit(edge.id) }] : [];
    });

  let traceSystem: SolidParticleSystem | null = null;
  let traceMesh: Mesh | null = null;
  if (activeRoutes.length > 0) {
    const traceShape = MeshBuilder.CreateSphere("os-trace-shape", { diameter: 0.11, segments: 5 }, scene);
    traceShape.isVisible = false;
    traceSystem = new SolidParticleSystem("os-trace-sps", scene, { isPickable: false });
    traceSystem.addShape(traceShape, activeRoutes.length);
    traceShape.dispose();
    traceSystem.buildMesh();
    traceSystem.computeParticleRotation = false;
    traceSystem.computeParticleColor = true;
    activeRoutes.forEach((route, index) => {
      const particle = traceSystem?.particles[index];
      if (!particle) return;
      particle.position.copyFrom(route.from);
      particle.color = new Color4(goldBright.r, goldBright.g, goldBright.b, 0.96);
    });
    traceSystem.setParticles();
    traceMesh = traceSystem.mesh;
    if (traceMesh) {
      traceMesh.parent = root;
      traceMesh.hasVertexAlpha = true;
      const material = new StandardMaterial("os-trace-material", scene);
      material.emissiveColor = goldBright;
      material.diffuseColor = gold.scale(0.1);
      material.alpha = 0.96;
      traceMesh.material = material;
      resources.push(material);
    }
    resources.push(traceSystem);
  }

  const coreRings: Mesh[] = [];
  const coreMaterial = new StandardMaterial("os-core-material", scene);
  coreMaterial.emissiveColor = goldBright.scale(0.88);
  coreMaterial.diffuseColor = gold.scale(0.08);
  coreMaterial.alpha = 0.86;
  resources.push(coreMaterial);
  for (let index = 0; index < 3; index += 1) {
    const ring = MeshBuilder.CreateTorus(
      `os-core-ring:${index}`,
      { diameter: 1.9 + index * 0.58, thickness: 0.018 + index * 0.008, tessellation: 72 },
      scene,
    );
    ring.parent = root;
    ring.material = coreMaterial;
    ring.isPickable = false;
    ring.rotation.x = Math.PI / 2 + index * 0.54;
    ring.rotation.y = index * 0.72;
    coreRings.push(ring);
  }

  const focusHalo = MeshBuilder.CreateTorus("os-focus-halo", { diameter: 1.4, thickness: 0.028, tessellation: 64 }, scene);
  focusHalo.parent = root;
  focusHalo.material = coreMaterial;
  focusHalo.rotation.x = Math.PI / 2;
  focusHalo.isPickable = false;
  focusHalo.isVisible = false;

  return {
    root,
    resources,
    positions,
    sizes,
    nodeById,
    labels,
    clusterMeshes,
    clusterLabels,
    edgeMeshes,
    pickMeshes,
    nodeMesh,
    ambientMesh,
    traceMesh,
    traceSystem,
    traceRoutes: activeRoutes,
    coreRings,
    focusHalo,
  };
}

function disposeProjection(projection: VisualProjection | null) {
  if (!projection) return;
  projection.root.dispose(false);
  for (const resource of projection.resources) {
    try { resource.dispose(); } catch { /* Defensive teardown for Babylon resources. */ }
  }
}

export default function SpatialRenderer({
  graph,
  activity,
  phase,
  workspaceId,
  settings,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AbstractEngine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const cameraDirectorRef = useRef<CameraDirector | null>(null);
  const glowRef = useRef<GlowLayer | null>(null);
  const projectionRef = useRef<VisualProjection | null>(null);
  const gpuFieldRef = useRef<GpuSignalField | null>(null);
  const backendRef = useRef<RenderBackend>("WEBGL");
  const graphRef = useRef(graph);
  const activityRef = useRef(activity);
  const phaseRef = useRef(phase);
  const workspaceIdRef = useRef(workspaceId);
  const settingsRef = useRef(settings);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const hoverNodeIdRef = useRef<string | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const effectiveScaleRef = useRef(RENDER_PROFILES[settings.renderQuality].resolutionScale);
  const lastAdaptRef = useRef(0);
  const lastRenderRef = useRef(0);
  const lastTelemetryRef = useRef(0);
  const [zoomLevel, setZoomLevel] = useState<SemanticZoomLevel>("network");
  const zoomLevelRef = useRef<SemanticZoomLevel>("network");
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
  const [backend, setBackend] = useState<RenderBackend>("WEBGL");
  const [gpuTier, setGpuTier] = useState<GpuFeatureTier>("WEBGL_BATCHED");
  const [gpuSignals, setGpuSignals] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>(workspaceById(workspaceId).preferredCamera);
  const [measuredFps, setMeasuredFps] = useState(0);
  const [effectiveScale, setEffectiveScale] = useState(effectiveScaleRef.current);

  const activeWorkspace = useMemo(() => workspaceById(workspaceId), [workspaceId]);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { activityRef.current = activity; }, [activity]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { onSelectNodeRef.current = onSelectNode; }, [onSelectNode]);

  const rebuildGpuField = () => {
    gpuFieldRef.current?.dispose();
    gpuFieldRef.current = null;
    setGpuSignals(0);

    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene) return;

    const profile = RENDER_PROFILES[settingsRef.current.renderQuality];
    const computeSupported = GpuSignalField.supported(engine);
    const pipeline = describeGpuPipeline(
      backendRef.current,
      computeSupported,
      profile,
      settingsRef.current.ambientParticles,
    );
    setGpuTier(pipeline.tier);
    if (!pipeline.computeShaders || pipeline.signalParticleBudget <= 0) return;

    const theme = getTheme(settingsRef.current.themeId);
    try {
      gpuFieldRef.current = new GpuSignalField(engine, scene, {
        count: pipeline.signalParticleBudget,
        radius: workspaceById(workspaceIdRef.current).cameraRadius * 1.55,
        vertical: Math.max(10, workspaceById(workspaceIdRef.current).cameraRadius * 0.82),
        gold: parseHex(theme.gold),
        pointSize: settingsRef.current.renderQuality === "ULTRA" ? 1.55 : settingsRef.current.renderQuality === "HIGH" ? 1.35 : 1.1,
      });
      setGpuSignals(pipeline.signalParticleBudget);
    } catch (error) {
      console.warn("OS SpatialRenderer: compute signal field disabled after initialization failure.", error);
      setGpuTier("WEBGL_BATCHED");
      setGpuSignals(0);
    }
  };

  const rebuild = () => {
    const scene = sceneRef.current;
    const engine = engineRef.current;
    if (!scene || !engine) return;

    disposeProjection(projectionRef.current);
    projectionRef.current = makeProjection(scene, graphRef.current, workspaceIdRef.current, settingsRef.current, phaseRef.current);

    const workspace = workspaceById(workspaceIdRef.current);
    scene.fogDensity = workspace.fogDensity * settingsRef.current.depthFog;
    const theme = getTheme(settingsRef.current.themeId);
    const canvas = parseHex(theme.canvas);
    scene.clearColor = new Color4(canvas.r, canvas.g, canvas.b, 1);
    scene.fogColor = canvas;

    const profile = RENDER_PROFILES[settingsRef.current.renderQuality];
    effectiveScaleRef.current = profile.resolutionScale;
    engine.setHardwareScalingLevel(1 / profile.resolutionScale);
    setEffectiveScale(profile.resolutionScale);
    if (glowRef.current) glowRef.current.intensity = settingsRef.current.glowIntensity * profile.bloomScale;
  };

  useEffect(() => {
    rebuild();
    // Refs keep Babylon scene ownership outside React while this effect controls projection invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, workspaceId, settings.renderQuality, settings.themeId, settings.graphDensity, settings.labelDensity, settings.edgeIntensity, settings.ambientParticles, phase]);

  useEffect(() => {
    rebuildGpuField();
    // GPU signal storage only needs recreation when capacity/material calibration changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.renderQuality, settings.themeId, settings.ambientParticles]);

  useEffect(() => {
    const director = cameraDirectorRef.current;
    if (!director) return;
    director.setWorkspace(activeWorkspace);
    setCameraMode(activeWorkspace.preferredCamera);
  }, [activeWorkspace]);

  useEffect(() => {
    const projection = projectionRef.current;
    const director = cameraDirectorRef.current;
    selectedNodeIdRef.current = selectedNodeId;
    if (!projection || !selectedNodeId) {
      if (projection) projection.focusHalo.isVisible = false;
      if (director?.currentMode === "FOCUS") {
        director.setMode(activeWorkspace.preferredCamera, activeWorkspace);
        setCameraMode(activeWorkspace.preferredCamera);
      }
      return;
    }

    const position = projection.positions.get(selectedNodeId);
    if (!position) return;
    const focusRadius = Math.max(4.2, Math.min(7.5, activeWorkspace.cameraRadius * 0.34));
    director?.focus(position, focusRadius);
    setCameraMode("FOCUS");
    const size = projection.sizes.get(selectedNodeId) ?? 0.4;
    projection.focusHalo.position.copyFrom(position);
    projection.focusHalo.scaling.setAll(Math.max(0.72, size * 1.7));
    projection.focusHalo.isVisible = true;
  }, [selectedNodeId, activeWorkspace]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let pointerObserver: ReturnType<Scene["onPointerObservable"]["add"]> | null = null;
    const resize = () => engineRef.current?.resize();

    void (async () => {
      const created = await createEngine(canvas, settingsRef.current);
      if (disposed) {
        created.engine.dispose();
        return;
      }

      engineRef.current = created.engine;
      backendRef.current = created.backend;
      setBackend(created.backend);
      const scene = new Scene(created.engine);
      sceneRef.current = scene;
      const theme = getTheme(settingsRef.current.themeId);
      const canvasColor = parseHex(theme.canvas);
      scene.clearColor = new Color4(canvasColor.r, canvasColor.g, canvasColor.b, 1);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = canvasColor;
      scene.fogDensity = workspaceById(workspaceIdRef.current).fogDensity * settingsRef.current.depthFog;

      const workspace = workspaceById(workspaceIdRef.current);
      const camera = new ArcRotateCamera(
        "os-spatial-camera",
        -Math.PI / 2,
        Math.PI / 2.34,
        workspace.cameraRadius,
        Vector3.Zero(),
        scene,
      );
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

      const light = new HemisphericLight("os-ambient-light", new Vector3(0.2, 1, 0.15), scene);
      light.intensity = 0.34;
      light.diffuse = parseHex(theme.goldSoft);
      light.groundColor = parseHex(theme.canvas);

      const glow = new GlowLayer("os-gold-bloom", scene, { blurKernelSize: 38 });
      glowRef.current = glow;
      const profile = RENDER_PROFILES[settingsRef.current.renderQuality];
      glow.intensity = settingsRef.current.glowIntensity * profile.bloomScale;

      projectionRef.current = makeProjection(scene, graphRef.current, workspaceIdRef.current, settingsRef.current, phaseRef.current);
      rebuildGpuField();

      pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        const pickedMesh = pointerInfo.pickInfo?.pickedMesh as Mesh | null | undefined;
        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          if (pickedMesh?.metadata?.osPickNode) {
            const nodeId = String(pickedMesh.metadata.nodeId ?? "");
            const node = projectionRef.current?.nodeById.get(nodeId);
            if (node) {
              hoverNodeIdRef.current = node.id;
              canvas.style.cursor = "pointer";
              setHoverInfo({ id: node.id, label: node.label, kind: node.kind, importance: node.importance, confidence: node.confidence });
              const position = projectionRef.current?.positions.get(node.id);
              if (position && projectionRef.current && !selectedNodeIdRef.current) {
                const size = projectionRef.current.sizes.get(node.id) ?? 0.4;
                projectionRef.current.focusHalo.position.copyFrom(position);
                projectionRef.current.focusHalo.scaling.setAll(Math.max(0.68, size * 1.55));
                projectionRef.current.focusHalo.isVisible = true;
              }
              return;
            }
          }
          hoverNodeIdRef.current = null;
          canvas.style.cursor = "default";
          setHoverInfo(null);
          if (projectionRef.current && !selectedNodeIdRef.current) projectionRef.current.focusHalo.isVisible = false;
          return;
        }

        if (pointerInfo.type === PointerEventTypes.POINTERWHEEL || pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          cameraDirectorRef.current?.userControl();
          setCameraMode("FREE");
        }

        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
        if (pickedMesh?.metadata?.osPickNode) {
          const nodeId = String(pickedMesh.metadata.nodeId ?? "");
          const node = projectionRef.current?.nodeById.get(nodeId) ?? null;
          if (node) {
            const position = projectionRef.current?.positions.get(node.id);
            if (position) {
              const radius = Math.max(4.2, Math.min(7.5, workspaceById(workspaceIdRef.current).cameraRadius * 0.34));
              cameraDirectorRef.current?.focus(position, radius);
              setCameraMode("FOCUS");
            }
            onSelectNodeRef.current(node);
            return;
          }
        }
        onSelectNodeRef.current(null);
        const currentWorkspace = workspaceById(workspaceIdRef.current);
        cameraDirectorRef.current?.overview(currentWorkspace);
        setCameraMode("OVERVIEW");
      });

      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now();
        const currentSettings = settingsRef.current;
        const frameInterval = 1000 / currentSettings.targetFps;
        if (now - lastRenderRef.current < frameInterval * 0.82) return;
        lastRenderRef.current = now;

        const projection = projectionRef.current;
        const currentWorkspace = workspaceById(workspaceIdRef.current);
        const motion = currentSettings.reducedMotion ? 0 : currentSettings.animationIntensity;
        const time = now * 0.001;

        const nextZoom = semanticZoom(camera.radius);
        if (nextZoom !== zoomLevelRef.current) {
          zoomLevelRef.current = nextZoom;
          setZoomLevel(nextZoom);
        }

        cameraDirectorRef.current?.tick(
          camera,
          currentWorkspace,
          time,
          motion,
          currentSettings.reducedMotion,
          activityRef.current,
        );

        const gpuField = gpuFieldRef.current;
        if (gpuField) {
          gpuField.setVisible(nextZoom !== "inspect" && currentSettings.ambientParticles > 0.02);
          gpuField.tick(currentSettings.reducedMotion ? 0 : time, activityRef.current, motion, workspaceIdRef.current);
        }

        if (projection) {
          const showClusters = nextZoom === "universe" || nextZoom === "cluster";
          const showNodes = nextZoom !== "universe";
          const showEdges = nextZoom === "network" || nextZoom === "detail" || nextZoom === "inspect";
          if (projection.nodeMesh) projection.nodeMesh.isVisible = showNodes;
          for (const mesh of projection.clusterMeshes) mesh.isVisible = showClusters;
          for (const mesh of projection.clusterLabels) mesh.isVisible = showClusters;
          for (const mesh of projection.edgeMeshes) mesh.isVisible = showEdges;
          for (const mesh of projection.labels) {
            const importance = Number(mesh.metadata?.importance ?? 0);
            mesh.isVisible = nextZoom === "detail" || nextZoom === "inspect" || (nextZoom === "network" && importance >= 0.74);
          }

          if (projection.nodeMesh && motion > 0) projection.nodeMesh.rotation.y += 0.000025 * motion;
          if (projection.ambientMesh && motion > 0) {
            projection.ambientMesh.rotation.y -= 0.000035 * motion;
            projection.ambientMesh.rotation.x = Math.sin(time * 0.07) * 0.015;
          }
          projection.coreRings.forEach((ring, index) => {
            const direction = index % 2 === 0 ? 1 : -1;
            ring.rotation.z += direction * 0.0008 * motion;
            ring.rotation.y += direction * 0.00045 * motion;
            const pulse = 1 + Math.sin(time * (1.2 + index * 0.22) + activityRef.current * 0.18) * 0.025 * Math.max(0.2, motion);
            ring.scaling.setAll(pulse);
          });

          if (projection.focusHalo.isVisible) {
            projection.focusHalo.rotation.z += 0.0035 * Math.max(0.25, motion);
            const pulse = 1 + Math.sin(time * 3.4) * 0.055 * Math.max(0.2, motion);
            const base = selectedNodeIdRef.current
              ? Math.max(0.72, (projection.sizes.get(selectedNodeIdRef.current) ?? 0.4) * 1.7)
              : Math.max(0.68, (projection.sizes.get(hoverNodeIdRef.current ?? "") ?? 0.4) * 1.55);
            projection.focusHalo.scaling.setAll(base * pulse);
          }

          if (projection.traceSystem && projection.traceRoutes.length > 0 && motion > 0) {
            projection.traceRoutes.forEach((route, index) => {
              const particle = projection.traceSystem?.particles[index];
              if (!particle) return;
              const progress = (time * (0.38 + motion * 0.24) + route.offset) % 1;
              Vector3.LerpToRef(route.from, route.to, progress, particle.position);
            });
            projection.traceSystem.setParticles();
          }
        }

        if (currentSettings.adaptiveQuality && now - lastAdaptRef.current > 1600) {
          lastAdaptRef.current = now;
          const measured = created.engine.getFps();
          const activeProfile = RENDER_PROFILES[currentSettings.renderQuality];
          const nextScale = adaptiveResolutionScale(
            {
              requestedScale: activeProfile.resolutionScale,
              effectiveScale: effectiveScaleRef.current,
              targetFps: currentSettings.targetFps,
              measuredFps: measured,
            },
            activeProfile,
          );
          if (Math.abs(nextScale - effectiveScaleRef.current) >= 0.015) {
            effectiveScaleRef.current = nextScale;
            created.engine.setHardwareScalingLevel(1 / nextScale);
            setEffectiveScale(nextScale);
          }
        }

        if (now - lastTelemetryRef.current > 1000) {
          lastTelemetryRef.current = now;
          setMeasuredFps(Math.round(created.engine.getFps()));
        }
      });

      created.engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", resize);
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      const scene = sceneRef.current;
      if (scene && pointerObserver) scene.onPointerObservable.remove(pointerObserver);
      gpuFieldRef.current?.dispose();
      gpuFieldRef.current = null;
      disposeProjection(projectionRef.current);
      projectionRef.current = null;
      glowRef.current?.dispose();
      glowRef.current = null;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      cameraRef.current = null;
      cameraDirectorRef.current = null;
    };
  }, []);

  const selectCameraMode = (mode: CameraMode) => {
    const director = cameraDirectorRef.current;
    if (!director) return;
    const workspace = workspaceById(workspaceIdRef.current);
    const projection = projectionRef.current;
    const selectedId = selectedNodeIdRef.current;
    const selectedPosition = selectedId ? projection?.positions.get(selectedId) : null;
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

  return (
    <>
      <canvas ref={canvasRef} className="void-canvas" aria-label="OS spatial cognition renderer" />
      <div className={`spatial-navigator${selectedNodeId ? " node-selected" : ""}`}>
        <div className="spatial-level">
          <span>SEMANTIC LOD</span>
          <strong>{zoomLevel.toUpperCase()}</strong>
        </div>
        <div className="spatial-cluster">
          <span>RENDER FABRIC</span>
          <strong>{gpuTier === "WEBGPU_COMPUTE" ? "GPU COMPUTE" : "BATCHED"}</strong>
          <small>{backend} · {gpuSignals.toLocaleString()} SIG · {effectiveScale.toFixed(2)}× · {measuredFps} FPS</small>
        </div>
        <div className="camera-mode-strip" aria-label="Spatial camera mode">
          {CAMERA_MODES.map((mode) => (
            <button
              type="button"
              key={mode}
              className={cameraMode === mode ? "active" : ""}
              onClick={() => selectCameraMode(mode)}
              title={`${mode} camera mode`}
            >
              {mode.slice(0, 3)}
            </button>
          ))}
        </div>
        {selectedNodeId && (
          <button
            type="button"
            className="spatial-overview-button"
            onClick={() => selectCameraMode("OVERVIEW")}
          >
            OVERVIEW
          </button>
        )}
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
