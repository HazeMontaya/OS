import { useEffect, useRef } from "react";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

const positions = [
  [0, 0, 0], [3.2, 1.1, -1], [-3.4, 0.6, -1.8], [1.4, -2.5, -2.2],
  [-1.5, 2.8, -3.2], [5.1, -1.5, -5.3], [-5.4, 2, -5.8], [0.2, 4.7, -7],
  [2.8, 4.2, -8], [-3.2, -3.9, -7.5], [6.5, 3.6, -10], [-7.2, -2.8, -11],
] as const;

export default function CognitiveVoid({ activity }: { activity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.008, 0.012, 0.025, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.018;
    scene.fogColor = new Color3(0.008, 0.012, 0.025);

    const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.25, 18, Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 45;
    camera.wheelPrecision = 24;
    camera.panningSensibility = 90;
    camera.attachControl(canvas, true);

    new HemisphericLight("ambient", new Vector3(0, 1, 0), scene).intensity = 0.55;
    const glow = new GlowLayer("cognitive-glow", scene);
    glow.intensity = 0.85;

    const points = positions.map(([x, y, z], index) => {
      const sphere = MeshBuilder.CreateSphere(`node-${index}`, { diameter: index === 0 ? 1.05 : 0.28 + (index % 3) * 0.08 }, scene);
      sphere.position = new Vector3(x, y, z);
      const material = new StandardMaterial(`node-material-${index}`, scene);
      const energy = index === 0 ? new Color3(0.72, 0.92, 1) : new Color3(0.26, 0.58 + (index % 4) * 0.06, 0.95);
      material.emissiveColor = energy;
      material.diffuseColor = energy.scale(0.2);
      sphere.material = material;
      return sphere.position.clone();
    });

    const links = [[0,1],[0,2],[0,3],[0,4],[1,5],[2,6],[4,7],[7,8],[3,9],[5,10],[9,11]];
    links.forEach(([from, to], index) => {
      const line = MeshBuilder.CreateLines(`edge-${index}`, { points: [points[from], points[to]] }, scene);
      line.color = new Color3(0.12, 0.42, 0.82);
      line.alpha = 0.34;
    });

    scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.00018;
      camera.alpha += 0.00008;
      const root = scene.getMeshByName("node-0");
      if (root) {
        const pulse = 1 + Math.sin(t * 12 + activity * 0.4) * 0.045;
        root.scaling.setAll(pulse);
      }
    });

    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      scene.dispose();
      engine.dispose();
    };
  }, [activity]);

  return <canvas className="void-canvas" ref={canvasRef} />;
}
