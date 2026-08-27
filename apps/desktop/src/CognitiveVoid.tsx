import { useEffect, useMemo, useRef, useState } from "react";
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
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import type {
  CognitiveActivityPhase,
  CognitiveNode,
  GraphSnapshot,
} from "./cognitive";

type CognitiveVoidProps = {
  graph: GraphSnapshot;
  activity: number;
  phase: CognitiveActivityPhase | null;
  selectedNodeId: string | null;
  onSelectNode: (node: CognitiveNode | null) => void;
};

type SemanticZoomLevel = "universe" | "cluster" | "network" | "detail" | "inspect";

type ClusterProjection = {
  kind: string;
  center: Vector3;
  count: number;
  averageImportance: number;
  maxConfidence: number;
};

type HoverInfo =
  | { type: "node"; id: string; label: string; kind: string }
  | { type: "cluster"; id: string; label: string; kind: string; count: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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

function formatKind(kind: string) {
  return kind.replaceAll("_", " ").toUpperCase();
}

function semanticRadius(kind: string) {
  switch (kind) {
    case "self_model":
      return 0;
    case "actor":
      return 3.8;
    case "goal":
    case "project":
      return 5.2;
    case "episodic_memory":
      return 6.8;
    case "semantic_memory":
    case "stable_memory":
      return 8.1;
    case "agent":
    case "model":
      return 9.5;
    case "tool":
      return 10.8;
    default:
      return 8.8;
  }
}

function clusterSeed(kind: string) {
  if (kind === "self_model") return Vector3.Zero();
  const angle = hashUnit(`cluster-angle:${kind}`) * Math.PI * 2;
  const radius = semanticRadius(kind);
  const y = (hashUnit(`cluster-y:${kind}`) - 0.5) * Math.min(4.4, radius * 0.35);
  return new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function nodePosition(node: CognitiveNode, localIndex: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const center = clusterSeed(node.kind);
  const angle = localIndex * GOLDEN_ANGLE + hashUnit(node.id) * Math.PI * 2;
  const localRadius = 0.42 + hashUnit(`${node.id}:local-radius`) * 1.25;
  const y = (hashUnit(`${node.id}:vertical`) - 0.5) * 1.7;
  return center.add(new Vector3(Math.cos(angle) * localRadius, y, Math.sin(angle) * localRadius));
}

function buildProjection(graph: GraphSnapshot) {
  const positions = new Map<string, Vector3>();
  const kindIndexes = new Map<string, number>();
  const clusterMembers = new Map<string, CognitiveNode[]>();

  const orderedNodes = [...graph.nodes].sort((left, right) => {
    if (left.kind === "self_model" && right.kind !== "self_model") return -1;
    if (right.kind === "self_model" && left.kind !== "self_model") return 1;
    const kindOrder = left.kind.localeCompare(right.kind);
    return kindOrder === 0 ? left.id.localeCompare(right.id) : kindOrder;
  });

  for (const node of orderedNodes) {
    const localIndex = kindIndexes.get(node.kind) ?? 0;
    kindIndexes.set(node.kind, localIndex + 1);
    positions.set(node.id, nodePosition(node, localIndex));
    const members = clusterMembers.get(node.kind) ?? [];
    members.push(node);
    clusterMembers.set(node.kind, members);
  }

  const clusters: ClusterProjection[] = [];
  for (const [kind, members] of clusterMembers) {
    if (kind === "self_model") continue;
    const center = Vector3.Zero();
    let importance = 0;
    let maxConfidence = 0;
    for (const member of members) {
      center.addInPlace(positions.get(member.id) ?? Vector3.Zero());
      importance += clamp01(member.importance);
      maxConfidence = Math.max(maxConfidence, clamp01(member.confidence));
    }
    center.scaleInPlace(1 / members.length);
    clusters.push({
      kind,
      center,
      count: members.length,
      averageImportance: importance / members.length,
      maxConfidence,
    });
  }

  clusters.sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind));
  return { positions, clusters };
}

function kindEnergy(kind: string) {
  switch (kind) {
    case "self_model":
      return new Color3(0.82, 0.96, 1);
    case "actor":
      return new Color3(0.38, 0.84, 1);
    case "episodic_memory":
      return new Color3(0.22, 0.58, 0.98);
    case "semantic_memory":
    case "stable_memory":
      return new Color3(0.24, 0.78, 0.88);
    case "model":
      return new Color3(0.62, 0.42, 1);
    case "agent":
      return new Color3(0.34, 0.86, 0.78);
    case "tool":
      return new Color3(0.96, 0.7, 0.28);
    case "goal":
      return new Color3(0.96, 0.48, 0.62);
    default:
      return new Color3(0.4, 0.66, 0.96);
  }
}

function phaseEnergy(phase: CognitiveActivityPhase | null) {
  if (phase === "memory_recall") return new Color3(0.2, 0.82, 0.94);
  if (phase === "model_inference") return new Color3(0.7, 0.48, 1);
  if (phase === "output_persist") return new Color3(0.38, 0.94, 0.76);
  return new Color3(0.26, 0.56, 0.92);
}

function participatesInPhase(kind: string, phase: CognitiveActivityPhase | null) {
  if (!phase) return false;
  if (phase === "memory_recall") return kind.includes("memory");
  if (phase === "model_inference") return kind === "self_model" || kind === "model";
  if (phase === "output_persist") {
    return kind === "self_model" || kind === "model" || kind === "episodic_memory";
  }
  return false;
}

function semanticZoomLevel(radius: number): SemanticZoomLevel {
  if (radius >= 28) return "universe";
  if (radius >= 18) return "cluster";
  if (radius >= 10) return "network";
  if (radius >= 5.5) return "detail";
  return "inspect";
}

function createSpatialLabel(
  scene: Scene,
  id: string,
  text: string,
  position: Vector3,
  kind: string,
  ownerType: "node" | "cluster",
) {
  const display = text.length > 38 ? `${text.slice(0, 35)}…` : text;
  const width = Math.max(1.45, Math.min(5.1, display.length * 0.105));
  const height = ownerType === "cluster" ? 0.52 : 0.42;
  const texture = new DynamicTexture(
    `cog-label-texture:${ownerType}:${id}`,
    { width: 768, height: 112 },
    scene,
    false,
  );
  texture.hasAlpha = true;
  texture.drawText(
    display,
    null,
    72,
    ownerType === "cluster" ? "600 34px Segoe UI" : "500 30px Segoe UI",
    ownerType === "cluster" ? "#e7f7ff" : "#cfeaff",
    "transparent",
    true,
    true,
  );

  const material = new StandardMaterial(`cog-label-material:${ownerType}:${id}`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = kindEnergy(kind).scale(ownerType === "cluster" ? 0.78 : 0.62);
  material.disableLighting = true;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = ownerType === "cluster" ? 0.9 : 0.82;

  const plane = MeshBuilder.CreatePlane(
    `cog-label:${ownerType}:${id}`,
    { width, height },
    scene,
  );
  plane.position.copyFrom(position);
  plane.position.y += ownerType === "cluster" ? 0.9 : 0.62;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.material = material;
  plane.isPickable = false;
  plane.renderingGroupId = 2;
  plane.metadata = {
    cognitive: true,
    cognitiveLabel: true,
    ownerType,
    ownerId: id,
    kind,
  };
  return plane;
}

async function createRenderEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  if ("gpu" in navigator) {
    try {
      const webGpu = new WebGPUEngine(canvas, {
        antialias: true,
        adaptToDeviceRatio: true,
      });
      await webGpu.initAsync();
      return webGpu;
    } catch (error) {
      console.warn("WebGPU initialization failed; using WebGL fallback.", error);
    }
  }
  return new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true }, true);
}

function renderGraph(scene: Scene, graph: GraphSnapshot) {
  scene.meshes
    .filter((mesh) => mesh.metadata?.cognitive === true)
    .forEach((mesh) => mesh.dispose());
  [...scene.materials]
    .filter((material) => material.name.startsWith("cog-"))
    .forEach((material) => material.dispose());
  [...scene.textures]
    .filter((texture) => texture.name.startsWith("cog-label-texture:"))
    .forEach((texture) => texture.dispose());

  if (graph.nodes.length === 0) {
    const dormant = MeshBuilder.CreateSphere(
      "cog-dormant-core",
      { diameter: 0.72, segments: 24 },
      scene,
    );
    dormant.metadata = { cognitive: true, dormant: true };
    const material = new StandardMaterial("cog-material:dormant", scene);
    material.emissiveColor = new Color3(0.18, 0.34, 0.58);
    material.diffuseColor = material.emissiveColor.scale(0.12);
    material.alpha = 0.48;
    dormant.material = material;
    return;
  }

  const { positions, clusters } = buildProjection(graph);
  const nodeKinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));

  for (const node of graph.nodes) {
    const position = positions.get(node.id) ?? Vector3.Zero();
    const importance = clamp01(node.importance);
    const confidence = clamp01(node.confidence);
    const sphere = MeshBuilder.CreateSphere(
      `cog-node:${node.id}`,
      {
        diameter: node.kind === "self_model" ? 1.2 : 0.3 + importance * 0.56,
        segments: node.kind === "self_model" ? 36 : 18,
      },
      scene,
    );
    sphere.position.copyFrom(position);
    sphere.isPickable = true;
    sphere.metadata = {
      cognitive: true,
      cognitiveNode: true,
      id: node.id,
      kind: node.kind,
      label: node.label,
      importance,
      confidence,
    };

    const energy = kindEnergy(node.kind);
    const material = new StandardMaterial(`cog-material:${node.id}`, scene);
    material.emissiveColor = energy.scale(0.58 + confidence * 0.42);
    material.diffuseColor = energy.scale(0.11);
    material.alpha = 0.38 + confidence * 0.62;
    sphere.material = material;

    createSpatialLabel(scene, node.id, node.label, position, node.kind, "node");
  }

  for (const cluster of clusters) {
    const diameter = 0.7 + Math.min(1.35, Math.sqrt(cluster.count) * 0.17);
    const clusterMesh = MeshBuilder.CreateSphere(
      `cog-cluster:${cluster.kind}`,
      { diameter, segments: 22 },
      scene,
    );
    clusterMesh.position.copyFrom(cluster.center);
    clusterMesh.isPickable = true;
    clusterMesh.metadata = {
      cognitive: true,
      cognitiveCluster: true,
      kind: cluster.kind,
      count: cluster.count,
      averageImportance: cluster.averageImportance,
      maxConfidence: cluster.maxConfidence,
    };

    const energy = kindEnergy(cluster.kind);
    const material = new StandardMaterial(`cog-material:cluster:${cluster.kind}`, scene);
    material.emissiveColor = energy.scale(0.72);
    material.diffuseColor = energy.scale(0.08);
    material.alpha = 0.3 + cluster.maxConfidence * 0.3;
    clusterMesh.material = material;

    createSpatialLabel(
      scene,
      cluster.kind,
      `${formatKind(cluster.kind)} · ${cluster.count}`,
      cluster.center,
      cluster.kind,
      "cluster",
    );
  }

  const tracerMaterial = new StandardMaterial("cog-material:trace-packet", scene);
  tracerMaterial.emissiveColor = new Color3(0.55, 0.9, 1);
  tracerMaterial.diffuseColor = new Color3(0.04, 0.1, 0.14);
  tracerMaterial.alpha = 0.92;

  for (const edge of graph.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const historical = edge.valid_until_ms !== null;
    const weight = clamp01(edge.weight);
    const baseAlpha = historical ? 0.08 : 0.18 + weight * 0.52;
    const fromKind = nodeKinds.get(edge.from) ?? "unknown";
    const toKind = nodeKinds.get(edge.to) ?? "unknown";
    const line = MeshBuilder.CreateLines(
      `cog-edge:${edge.id}`,
      { points: [from, to], updatable: false },
      scene,
    );
    line.metadata = {
      cognitive: true,
      cognitiveEdge: true,
      id: edge.id,
      relation: edge.relation,
      historical,
      baseAlpha,
      fromId: edge.from,
      toId: edge.to,
      fromKind,
      toKind,
    };
    line.color = historical
      ? new Color3(0.28, 0.34, 0.44)
      : new Color3(0.16, 0.46, 0.84);
    line.alpha = baseAlpha;
    line.isPickable = false;

    if (!historical) {
      const tracer = MeshBuilder.CreateSphere(
        `cog-tracer:${edge.id}`,
        { diameter: 0.09, segments: 8 },
        scene,
      );
      tracer.material = tracerMaterial;
      tracer.isPickable = false;
      tracer.isVisible = false;
      tracer.metadata = {
        cognitive: true,
        cognitiveTracer: true,
        from: from.clone(),
        to: to.clone(),
        fromKind,
        toKind,
        offset: hashUnit(edge.id),
      };
    }
  }
}

export default function CognitiveVoid({
  graph,
  activity,
  phase,
  selectedNodeId,
  onSelectNode,
}: CognitiveVoidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const activityRef = useRef(activity);
  const phaseRef = useRef<CognitiveActivityPhase | null>(phase);
  const graphRef = useRef(graph);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredClusterRef = useRef<string | null>(null);
  const activeClusterRef = useRef<string | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const focusTargetRef = useRef(Vector3.Zero());
  const desiredRadiusRef = useRef<number | null>(null);
  const zoomLevelRef = useRef<SemanticZoomLevel>("cluster");
  const [zoomLevel, setZoomLevel] = useState<SemanticZoomLevel>("cluster");
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  const clusterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of graph.nodes) {
      if (node.kind === "self_model") continue;
      counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    }
    return counts;
  }, [graph]);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    const selectedMesh = selectedNodeId
      ? sceneRef.current?.getMeshByName(`cog-node:${selectedNodeId}`)
      : null;
    if (selectedMesh) {
      focusTargetRef.current = selectedMesh.position.clone();
      desiredRadiusRef.current = 6.4;
    } else if (!activeClusterRef.current) {
      focusTargetRef.current = Vector3.Zero();
    }
  }, [selectedNodeId]);

  useEffect(() => {
    graphRef.current = graph;
    if (sceneRef.current) {
      renderGraph(sceneRef.current, graph);
      const selectedMesh = selectedNodeIdRef.current
        ? sceneRef.current.getMeshByName(`cog-node:${selectedNodeIdRef.current}`)
        : null;
      if (selectedMesh) {
        focusTargetRef.current = selectedMesh.position.clone();
      } else if (activeClusterRef.current) {
        const clusterMesh = sceneRef.current.getMeshByName(`cog-cluster:${activeClusterRef.current}`);
        focusTargetRef.current = clusterMesh?.position.clone() ?? Vector3.Zero();
      } else {
        focusTargetRef.current = Vector3.Zero();
      }
    }
  }, [graph]);

  const returnToOverview = () => {
    activeClusterRef.current = null;
    setActiveCluster(null);
    hoveredNodeIdRef.current = null;
    hoveredClusterRef.current = null;
    setHoverInfo(null);
    focusTargetRef.current = Vector3.Zero();
    desiredRadiusRef.current = 31;
    onSelectNodeRef.current(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let engine: AbstractEngine | null = null;
    let scene: Scene | null = null;
    const resize = () => engine?.resize();

    const updateHover = (pickedMesh: Mesh | null) => {
      if (pickedMesh?.metadata?.cognitiveNode) {
        const nodeId = String(pickedMesh.metadata.id ?? "");
        if (nodeId === hoveredNodeIdRef.current && hoveredClusterRef.current === null) return;
        const node = graphRef.current.nodes.find((candidate) => candidate.id === nodeId);
        hoveredNodeIdRef.current = nodeId;
        hoveredClusterRef.current = null;
        canvas.style.cursor = "pointer";
        setHoverInfo(
          node
            ? { type: "node", id: node.id, label: node.label, kind: node.kind }
            : null,
        );
        return;
      }

      if (pickedMesh?.metadata?.cognitiveCluster) {
        const kind = String(pickedMesh.metadata.kind ?? "");
        if (kind === hoveredClusterRef.current && hoveredNodeIdRef.current === null) return;
        hoveredNodeIdRef.current = null;
        hoveredClusterRef.current = kind;
        canvas.style.cursor = "pointer";
        setHoverInfo({
          type: "cluster",
          id: kind,
          label: formatKind(kind),
          kind,
          count: Number(pickedMesh.metadata.count ?? 0),
        });
        return;
      }

      if (!hoveredNodeIdRef.current && !hoveredClusterRef.current) return;
      hoveredNodeIdRef.current = null;
      hoveredClusterRef.current = null;
      canvas.style.cursor = "default";
      setHoverInfo(null);
    };

    void (async () => {
      engine = await createRenderEngine(canvas);
      if (disposed) {
        engine.dispose();
        return;
      }

      scene = new Scene(engine);
      sceneRef.current = scene;
      scene.clearColor = new Color4(0.008, 0.012, 0.025, 1);
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogDensity = 0.014;
      scene.fogColor = new Color3(0.008, 0.012, 0.025);

      const camera = new ArcRotateCamera(
        "cognitive-camera",
        -Math.PI / 2,
        Math.PI / 2.28,
        19,
        Vector3.Zero(),
        scene,
      );
      cameraRef.current = camera;
      camera.lowerRadiusLimit = 3.2;
      camera.upperRadiusLimit = 80;
      camera.wheelPrecision = 24;
      camera.panningSensibility = 90;
      camera.inertia = 0.84;
      camera.attachControl(canvas, true);

      const light = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
      light.intensity = 0.5;
      const glow = new GlowLayer("cognitive-glow", scene);
      glow.intensity = 0.84;

      renderGraph(scene, graphRef.current);

      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          updateHover((pointerInfo.pickInfo?.pickedMesh as Mesh | null) ?? null);
          return;
        }

        if (
          pointerInfo.type === PointerEventTypes.POINTERWHEEL ||
          pointerInfo.type === PointerEventTypes.POINTERDOWN
        ) {
          desiredRadiusRef.current = null;
        }

        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
        const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
        if (pickedMesh?.metadata?.cognitiveNode) {
          const nodeId = String(pickedMesh.metadata.id ?? "");
          const node = graphRef.current.nodes.find((candidate) => candidate.id === nodeId) ?? null;
          if (node) {
            focusTargetRef.current = pickedMesh.position.clone();
            desiredRadiusRef.current = 6.4;
            onSelectNodeRef.current(node);
            return;
          }
        }

        if (pickedMesh?.metadata?.cognitiveCluster) {
          const kind = String(pickedMesh.metadata.kind ?? "");
          activeClusterRef.current = kind;
          setActiveCluster(kind);
          focusTargetRef.current = pickedMesh.position.clone();
          desiredRadiusRef.current = 13.2;
          onSelectNodeRef.current(null);
          return;
        }

        onSelectNodeRef.current(null);
        if (!activeClusterRef.current) focusTargetRef.current = Vector3.Zero();
      });

      scene.onBeforeRenderObservable.add(() => {
        const time = performance.now() * 0.001;
        const currentLevel = semanticZoomLevel(camera.radius);
        if (currentLevel !== zoomLevelRef.current) {
          zoomLevelRef.current = currentLevel;
          setZoomLevel(currentLevel);
        }

        if (!selectedNodeIdRef.current && !activeClusterRef.current) camera.alpha += 0.000045;
        Vector3.LerpToRef(camera.target, focusTargetRef.current, 0.075, camera.target);

        if (desiredRadiusRef.current !== null) {
          const targetRadius = desiredRadiusRef.current;
          camera.radius += (targetRadius - camera.radius) * 0.085;
          if (Math.abs(targetRadius - camera.radius) < 0.045) desiredRadiusRef.current = null;
        }

        const currentPhase = phaseRef.current;
        const phaseAmplitude = currentPhase === "model_inference" ? 0.11 : 0.075;
        const wave = Math.sin(time * (currentPhase ? 5.2 : 2.4) + activityRef.current * 0.31);
        const selectedId = selectedNodeIdRef.current;
        const hoveredId = hoveredNodeIdRef.current;
        const hoveredCluster = hoveredClusterRef.current;
        const clusterFocus = activeClusterRef.current;

        scene?.meshes.forEach((mesh) => {
          if (mesh.metadata?.cognitiveNode) {
            const kind = String(mesh.metadata.kind ?? "");
            const nodeId = String(mesh.metadata.id ?? "");
            const importance = Number(mesh.metadata.importance ?? 0);
            const active = participatesInPhase(kind, currentPhase);
            const selected = nodeId === selectedId;
            const hovered = nodeId === hoveredId;
            const inCluster = !clusterFocus || kind === clusterFocus || kind === "self_model";
            const levelVisible =
              kind === "self_model" ||
              currentLevel === "network" ||
              currentLevel === "detail" ||
              currentLevel === "inspect" ||
              (currentLevel === "cluster" && importance >= 0.68);
            const visible = inCluster && levelVisible;
            mesh.isVisible = visible;
            mesh.isPickable = visible;
            if (!visible) return;

            mesh.visibility = clusterFocus && kind !== clusterFocus && kind !== "self_model" ? 0.18 : 1;
            const amplitude = active ? phaseAmplitude : kind === "self_model" ? 0.04 : 0.012;
            const interactionScale = selected ? 1.35 : hovered ? 1.18 : 1;
            mesh.scaling.setAll(interactionScale * (1 + wave * amplitude));
            return;
          }

          if (mesh.metadata?.cognitiveCluster) {
            const kind = String(mesh.metadata.kind ?? "");
            const visible = currentLevel === "universe" || currentLevel === "cluster";
            mesh.isVisible = visible;
            mesh.isPickable = visible;
            if (!visible) return;
            const hovered = kind === hoveredCluster;
            const focused = kind === clusterFocus;
            mesh.visibility = focused ? 1 : clusterFocus ? 0.18 : 0.72;
            mesh.scaling.setAll((hovered ? 1.18 : focused ? 1.12 : 1) * (1 + wave * 0.025));
            return;
          }

          if (mesh.metadata?.cognitiveLabel) {
            const ownerType = String(mesh.metadata.ownerType ?? "");
            const ownerId = String(mesh.metadata.ownerId ?? "");
            const kind = String(mesh.metadata.kind ?? "");
            if (ownerType === "cluster") {
              mesh.isVisible = currentLevel === "universe" || currentLevel === "cluster";
              mesh.visibility = clusterFocus && kind !== clusterFocus ? 0.18 : 1;
              return;
            }

            const node = graphRef.current.nodes.find((candidate) => candidate.id === ownerId);
            const important = (node?.importance ?? 0) >= 0.76;
            const promoted = ownerId === selectedId || ownerId === hoveredId;
            const inCluster = !clusterFocus || kind === clusterFocus || kind === "self_model";
            const visible =
              inCluster &&
              (promoted || currentLevel === "detail" || currentLevel === "inspect" ||
                (currentLevel === "network" && important));
            mesh.isVisible = visible;
            mesh.visibility = promoted ? 1 : currentLevel === "network" ? 0.72 : 0.9;
            return;
          }

          if (mesh.metadata?.cognitiveEdge && mesh instanceof LinesMesh) {
            const fromKind = String(mesh.metadata.fromKind ?? "");
            const toKind = String(mesh.metadata.toKind ?? "");
            const fromId = String(mesh.metadata.fromId ?? "");
            const toId = String(mesh.metadata.toId ?? "");
            const active =
              participatesInPhase(fromKind, currentPhase) ||
              participatesInPhase(toKind, currentPhase);
            const historical = Boolean(mesh.metadata.historical);
            const baseAlpha = Number(mesh.metadata.baseAlpha ?? 0.16);
            const edgeLevelVisible =
              currentLevel === "network" || currentLevel === "detail" || currentLevel === "inspect";
            const clusterVisible =
              !clusterFocus ||
              ((fromKind === clusterFocus || fromKind === "self_model") &&
                (toKind === clusterFocus || toKind === "self_model"));
            const selectedNeighborhood = !selectedId || fromId === selectedId || toId === selectedId;
            const visible = edgeLevelVisible && clusterVisible && (currentLevel !== "inspect" || selectedNeighborhood);
            mesh.isVisible = visible;
            if (!visible) return;
            mesh.alpha = active
              ? Math.min(1, 0.62 + (wave + 1) * 0.12)
              : selectedNeighborhood && selectedId
                ? Math.min(0.9, baseAlpha + 0.2)
                : baseAlpha;
            mesh.color = active
              ? phaseEnergy(currentPhase)
              : historical
                ? new Color3(0.28, 0.34, 0.44)
                : new Color3(0.16, 0.46, 0.84);
            return;
          }

          if (mesh.metadata?.cognitiveTracer) {
            const fromKind = String(mesh.metadata.fromKind ?? "");
            const toKind = String(mesh.metadata.toKind ?? "");
            const active =
              participatesInPhase(fromKind, currentPhase) ||
              participatesInPhase(toKind, currentPhase);
            const levelVisible =
              currentLevel === "network" || currentLevel === "detail" || currentLevel === "inspect";
            const clusterVisible =
              !clusterFocus ||
              ((fromKind === clusterFocus || fromKind === "self_model") &&
                (toKind === clusterFocus || toKind === "self_model"));
            mesh.isVisible = active && levelVisible && clusterVisible;
            if (!mesh.isVisible) return;

            const from = mesh.metadata.from as Vector3;
            const to = mesh.metadata.to as Vector3;
            const offset = Number(mesh.metadata.offset ?? 0);
            const progress = (time * 0.48 + offset) % 1;
            Vector3.LerpToRef(from, to, progress, mesh.position);
            mesh.scaling.setAll(0.8 + (wave + 1) * 0.16);
          }
        });
      });

      engine.runRenderLoop(() => scene?.render());
      window.addEventListener("resize", resize);
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      sceneRef.current = null;
      cameraRef.current = null;
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  return (
    <>
      <canvas className="void-canvas" ref={canvasRef} />
      <aside className={`spatial-navigator${selectedNodeId ? " node-selected" : ""}`}>
        <div className="spatial-level">
          <span>SEMANTIC ZOOM</span>
          <strong>{zoomLevel.toUpperCase()}</strong>
        </div>
        {activeCluster && (
          <div className="spatial-cluster">
            <span>CLUSTER</span>
            <strong>{formatKind(activeCluster)}</strong>
            <small>{clusterCounts.get(activeCluster) ?? 0} nodes</small>
          </div>
        )}
        {(activeCluster || zoomLevel !== "universe") && (
          <button type="button" onClick={returnToOverview}>OVERVIEW</button>
        )}
      </aside>

      {hoverInfo && (
        <div className="spatial-hover-readout" aria-live="polite">
          <span>{hoverInfo.type === "cluster" ? "CLUSTER" : "KNOWLEDGE NODE"}</span>
          <strong>{hoverInfo.label}</strong>
          <small>
            {hoverInfo.type === "cluster"
              ? `${hoverInfo.count} nodes · click to enter`
              : `${formatKind(hoverInfo.kind)} · click to inspect`}
          </small>
        </div>
      )}
    </>
  );
}
