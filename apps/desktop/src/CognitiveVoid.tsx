import { useEffect, useRef } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
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
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function semanticRadius(kind: string) {
  switch (kind) {
    case "self_model":
      return 0;
    case "actor":
      return 3.2;
    case "goal":
    case "project":
      return 4.5;
    case "episodic_memory":
      return 5.8;
    case "semantic_memory":
    case "stable_memory":
      return 7.2;
    case "agent":
    case "model":
      return 8.2;
    case "tool":
      return 9.4;
    default:
      return 7.8;
  }
}

function nodePosition(node: CognitiveNode, index: number) {
  if (node.kind === "self_model") return Vector3.Zero();
  const angle = index * GOLDEN_ANGLE + hashUnit(node.id) * Math.PI * 2;
  const radius = semanticRadius(node.kind) + hashUnit(`${node.id}:radius`) * 1.7;
  const verticalSpread = node.kind === "actor" ? 1.4 : Math.min(7, radius * 0.72);
  return new Vector3(
    Math.cos(angle) * radius,
    (hashUnit(`${node.id}:vertical`) - 0.5) * verticalSpread,
    Math.sin(angle) * radius,
  );
}

function nodeEnergy(node: CognitiveNode) {
  switch (node.kind) {
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
    .filter((material) => material.name.startsWith("cog-material:"))
    .forEach((material) => material.dispose());

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

  const orderedNodes = [...graph.nodes].sort((left, right) => {
    if (left.kind === "self_model" && right.kind !== "self_model") return -1;
    if (right.kind === "self_model" && left.kind !== "self_model") return 1;
    return left.id.localeCompare(right.id);
  });
  const positions = new Map<string, Vector3>();
  const nodeKinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));

  orderedNodes.forEach((node, index) => {
    const position = nodePosition(node, index);
    positions.set(node.id, position);
    const importance = Math.max(0, Math.min(1, node.importance));
    const confidence = Math.max(0, Math.min(1, node.confidence));
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

    const energy = nodeEnergy(node);
    const material = new StandardMaterial(`cog-material:${node.id}`, scene);
    material.emissiveColor = energy.scale(0.58 + confidence * 0.42);
    material.diffuseColor = energy.scale(0.11);
    material.alpha = 0.38 + confidence * 0.62;
    sphere.material = material;
  });

  const tracerMaterial = new StandardMaterial("cog-material:trace-packet", scene);
  tracerMaterial.emissiveColor = new Color3(0.55, 0.9, 1);
  tracerMaterial.diffuseColor = new Color3(0.04, 0.1, 0.14);
  tracerMaterial.alpha = 0.92;

  graph.edges.forEach((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return;

    const historical = edge.valid_until_ms !== null;
    const weight = Math.max(0, Math.min(1, edge.weight));
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
      fromKind,
      toKind,
    };
    line.color = historical
      ? new Color3(0.28, 0.34, 0.44)
      : new Color3(0.16, 0.46, 0.84);
    line.alpha = baseAlpha;
    line.isPickable = true;

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
  });
}

export default function CognitiveVoid({ graph, activity, phase }: CognitiveVoidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const activityRef = useRef(activity);
  const phaseRef = useRef<CognitiveActivityPhase | null>(phase);
  const graphRef = useRef(graph);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    graphRef.current = graph;
    if (sceneRef.current) renderGraph(sceneRef.current, graph);
  }, [graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let engine: AbstractEngine | null = null;
    let scene: Scene | null = null;
    const resize = () => engine?.resize();

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

      scene.onBeforeRenderObservable.add(() => {
        const time = performance.now() * 0.001;
        camera.alpha += 0.000045;
        const currentPhase = phaseRef.current;
        const phaseAmplitude = currentPhase === "model_inference" ? 0.11 : 0.075;
        const wave = Math.sin(time * (currentPhase ? 5.2 : 2.4) + activityRef.current * 0.31);

        scene?.meshes.forEach((mesh) => {
          if (mesh.metadata?.cognitiveNode) {
            const kind = String(mesh.metadata.kind ?? "");
            const active = participatesInPhase(kind, currentPhase);
            const amplitude = active ? phaseAmplitude : kind === "self_model" ? 0.04 : 0.012;
            mesh.scaling.setAll(1 + wave * amplitude);
            return;
          }

          if (mesh.metadata?.cognitiveEdge && mesh instanceof LinesMesh) {
            const fromKind = String(mesh.metadata.fromKind ?? "");
            const toKind = String(mesh.metadata.toKind ?? "");
            const active =
              participatesInPhase(fromKind, currentPhase) ||
              participatesInPhase(toKind, currentPhase);
            const historical = Boolean(mesh.metadata.historical);
            const baseAlpha = Number(mesh.metadata.baseAlpha ?? 0.16);
            mesh.alpha = active ? Math.min(1, 0.62 + (wave + 1) * 0.12) : baseAlpha;
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
            mesh.isVisible = active;
            if (!active) return;

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
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  return <canvas className="void-canvas" ref={canvasRef} />;
}
