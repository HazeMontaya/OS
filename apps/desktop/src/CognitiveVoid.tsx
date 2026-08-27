import { useEffect, useRef } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import type { CognitiveNode, GraphSnapshot } from "./cognitive";

type CognitiveVoidProps = {
  graph: GraphSnapshot;
  activity: number;
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

function nodePosition(node: CognitiveNode, index: number) {
  if (node.kind === "actor") return Vector3.Zero();

  const ordinal = index + 1;
  const angle = ordinal * GOLDEN_ANGLE + hashUnit(node.id) * Math.PI * 2;
  const radius = 3.2 + Math.sqrt(ordinal) * 1.45;
  const vertical = (hashUnit(`${node.id}:vertical`) - 0.5) * Math.min(7, radius * 0.9);
  const depthBias = node.kind === "episodic_memory" ? -0.8 : 0;

  return new Vector3(
    Math.cos(angle) * radius,
    vertical,
    Math.sin(angle) * radius + depthBias,
  );
}

function nodeEnergy(node: CognitiveNode) {
  if (node.kind === "actor") return new Color3(0.72, 0.93, 1);
  if (node.kind === "episodic_memory") return new Color3(0.22, 0.58, 0.98);
  if (node.kind === "model") return new Color3(0.62, 0.42, 1);
  if (node.kind === "agent") return new Color3(0.34, 0.86, 0.78);
  if (node.kind === "tool") return new Color3(0.96, 0.7, 0.28);
  return new Color3(0.4, 0.66, 0.96);
}

export default function CognitiveVoid({ graph, activity }: CognitiveVoidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const activityRef = useRef(activity);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
    const scene = new Scene(engine);
    sceneRef.current = scene;
    scene.clearColor = new Color4(0.008, 0.012, 0.025, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.018;
    scene.fogColor = new Color3(0.008, 0.012, 0.025);

    const camera = new ArcRotateCamera(
      "cognitive-camera",
      -Math.PI / 2,
      Math.PI / 2.25,
      18,
      Vector3.Zero(),
      scene,
    );
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 60;
    camera.wheelPrecision = 24;
    camera.panningSensibility = 90;
    camera.inertia = 0.84;
    camera.attachControl(canvas, true);

    const light = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    light.intensity = 0.52;

    const glow = new GlowLayer("cognitive-glow", scene);
    glow.intensity = 0.82;

    scene.onBeforeRenderObservable.add(() => {
      const time = performance.now() * 0.001;
      const pulse = 1 + Math.sin(time * 2.4 + activityRef.current * 0.31) * 0.035;
      const actor = scene.getMeshByName("cog-node:actor:user");
      if (actor) actor.scaling.setAll(pulse);
    });

    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      sceneRef.current = null;
      scene.dispose();
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.meshes
      .filter((mesh) => mesh.metadata?.cognitive === true)
      .forEach((mesh) => mesh.dispose());

    if (graph.nodes.length === 0) {
      const dormant = MeshBuilder.CreateSphere(
        "cog-dormant-core",
        { diameter: 0.72, segments: 24 },
        scene,
      );
      dormant.metadata = { cognitive: true, dormant: true };
      const material = new StandardMaterial("cog-dormant-material", scene);
      material.emissiveColor = new Color3(0.18, 0.34, 0.58);
      material.diffuseColor = material.emissiveColor.scale(0.12);
      material.alpha = 0.48;
      dormant.material = material;
      return;
    }

    const orderedNodes = [...graph.nodes].sort((left, right) => {
      if (left.kind === "actor" && right.kind !== "actor") return -1;
      if (right.kind === "actor" && left.kind !== "actor") return 1;
      return left.id.localeCompare(right.id);
    });

    const positions = new Map<string, Vector3>();

    orderedNodes.forEach((node, index) => {
      const position = nodePosition(node, index);
      positions.set(node.id, position);

      const importance = Math.max(0, Math.min(1, node.importance));
      const confidence = Math.max(0, Math.min(1, node.confidence));
      const diameter = node.kind === "actor" ? 1.05 : 0.3 + importance * 0.5;
      const sphere = MeshBuilder.CreateSphere(
        `cog-node:${node.id}`,
        { diameter, segments: node.kind === "actor" ? 32 : 18 },
        scene,
      );
      sphere.position.copyFrom(position);
      sphere.metadata = {
        cognitive: true,
        cognitiveNode: true,
        id: node.id,
        kind: node.kind,
        label: node.label,
      };

      const energy = nodeEnergy(node);
      const material = new StandardMaterial(`cog-material:${node.id}`, scene);
      material.emissiveColor = energy.scale(0.6 + confidence * 0.4);
      material.diffuseColor = energy.scale(0.12);
      material.alpha = 0.42 + confidence * 0.58;
      sphere.material = material;
    });

    graph.edges.forEach((edge) => {
      if (edge.valid_until_ms !== null) return;
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return;

      const line = MeshBuilder.CreateLines(
        `cog-edge:${edge.id}`,
        { points: [from, to], updatable: false },
        scene,
      );
      line.metadata = {
        cognitive: true,
        cognitiveEdge: true,
        relation: edge.relation,
      };
      line.color = new Color3(0.16, 0.46, 0.84);
      line.alpha = 0.18 + Math.max(0, Math.min(1, edge.weight)) * 0.5;
    });
  }, [graph]);

  return <canvas className="void-canvas" ref={canvasRef} />;
}
