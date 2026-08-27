import type { WorkspaceId } from "@os/protocol";
import { StorageBuffer } from "@babylonjs/core/Buffers/storageBuffer";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ComputeShader } from "@babylonjs/core/Compute/computeShader";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

const WORKGROUP_SIZE = 64;
const PARAM_FLOATS = 8;

const SIGNAL_FIELD_WGSL = /* wgsl */ `
struct Params {
  time: f32,
  delta: f32,
  count: f32,
  activity: f32,
  motion: f32,
  workspace: f32,
  radius: f32,
  vertical: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> params: Params;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 12.9898 + params.workspace * 78.233) * 43758.5453);
}

@compute @workgroup_size(${WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  let count = u32(params.count);
  if (index >= count) {
    return;
  }

  let i = f32(index);
  let golden = 2.39996323;
  let seedA = hash11(i + 0.17);
  let seedB = hash11(i * 1.713 + 4.91);
  let seedC = hash11(i * 0.731 + 11.2);
  let energy = clamp(params.activity * 0.035, 0.0, 1.8);
  let motion = max(0.0, params.motion);
  let workspace = u32(params.workspace + 0.5);

  var angle = i * golden + params.time * (0.012 + motion * 0.018) * select(-1.0, 1.0, (index & 1u) == 0u);
  var radius = 5.0 + seedA * params.radius;
  var y = (seedB - 0.5) * params.vertical;

  // Each OS Void gets a distinct large-scale signal choreography while remaining deterministic.
  if (workspace == 2u) {
    // Memory Archive: temporal helix / depth strata.
    angle = i * 0.087 + params.time * 0.012 * motion;
    radius = 7.0 + seedA * params.radius * 0.72;
    y = (fract(i * 0.013) - 0.5) * params.vertical * 1.35 + sin(angle * 0.28) * 1.4;
  } else if (workspace == 3u) {
    // Agent Operations: compact execution orbits.
    radius = 4.0 + floor(seedA * 5.0) * 3.25 + seedC * 1.4;
    y = (seedB - 0.5) * params.vertical * 0.55 + sin(angle * 1.7 + params.time) * 0.35 * energy;
  } else if (workspace == 4u) {
    // Developer Matrix: trace rails and diagnostic bands.
    let lane = floor(seedA * 11.0) - 5.0;
    let travel = fract(seedB + params.time * (0.015 + motion * 0.028));
    let x = (travel - 0.5) * params.radius * 2.0;
    let z = lane * 2.1;
    let yy = (seedC - 0.5) * params.vertical * 0.62;
    particles[index] = vec4<f32>(x, yy, z, 1.0);
    return;
  } else if (workspace == 5u) {
    // System Fabric: concentric infrastructure rings.
    radius = 5.0 + floor(seedA * 9.0) * 2.4 + seedC * 0.8;
    y = (floor(seedB * 7.0) - 3.0) * 1.2;
  } else if (workspace == 6u) {
    // Configuration Chamber: restrained core shell.
    radius = 5.5 + seedA * min(params.radius, 12.0);
    y = (seedB - 0.5) * min(params.vertical, 8.0);
    angle = i * golden + params.time * 0.006 * motion;
  } else if (workspace == 7u) {
    // Automation Circuit: flowing lanes around the central execution plane.
    let lane = floor(seedA * 9.0) - 4.0;
    let travel = fract(seedB + params.time * (0.018 + motion * 0.03));
    let x = (travel - 0.5) * params.radius * 1.8;
    let z = lane * 2.4 + sin(travel * 6.28318) * 0.6;
    let yy = (seedC - 0.5) * params.vertical * 0.28;
    particles[index] = vec4<f32>(x, yy, z, 1.0);
    return;
  }

  let ripple = sin(angle * 0.37 + params.time * 0.19 + seedC * 6.28318);
  let breathe = 1.0 + ripple * (0.018 + energy * 0.012);
  let x = cos(angle) * radius * breathe;
  let z = sin(angle) * radius * breathe;
  y = y + ripple * (0.32 + energy * 0.42);

  particles[index] = vec4<f32>(x, y, z, 1.0);
}
`;

function workspaceIndex(id: WorkspaceId): number {
  switch (id) {
    case "main": return 0;
    case "knowledge": return 1;
    case "memory": return 2;
    case "agents": return 3;
    case "developer": return 4;
    case "system": return 5;
    case "settings": return 6;
    case "automation": return 7;
    default: return 0;
  }
}

export type GpuSignalFieldOptions = {
  count: number;
  radius: number;
  vertical: number;
  gold: Color3;
  pointSize: number;
};

/**
 * WebGPU-only ambient signal field.
 *
 * Positions live in one storage buffer that is also bound directly as a vertex buffer. A WGSL
 * compute shader mutates that buffer every frame and Babylon renders it without any GPU -> CPU
 * readback. This is the first OS rendering path where simulation data never leaves the GPU.
 */
export class GpuSignalField {
  readonly count: number;
  private readonly engine: AbstractEngine;
  private readonly particles: StorageBuffer;
  private readonly params: StorageBuffer;
  private readonly compute: ComputeShader;
  private readonly vertexBuffer: VertexBuffer;
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly parameterData = new Float32Array(PARAM_FLOATS);
  private readonly radius: number;
  private readonly vertical: number;
  private lastTime = 0;
  private ready = false;

  static supported(engine: AbstractEngine): boolean {
    return Boolean(engine.getCaps().supportComputeShaders);
  }

  constructor(engine: AbstractEngine, scene: Scene, options: GpuSignalFieldOptions) {
    if (!GpuSignalField.supported(engine)) {
      throw new Error("WebGPU compute shaders are not supported by this engine.");
    }

    this.engine = engine;
    this.count = Math.max(64, Math.floor(options.count));
    this.radius = Math.max(8, options.radius);
    this.vertical = Math.max(4, options.vertical);

    const particleData = new Float32Array(this.count * 4);
    this.particles = new StorageBuffer(
      engine,
      particleData.byteLength,
      Constants.BUFFER_CREATIONFLAG_READWRITE | Constants.BUFFER_CREATIONFLAG_VERTEX,
      "OS GPU signal particle storage",
    );
    this.particles.update(particleData);

    this.params = new StorageBuffer(
      engine,
      this.parameterData.byteLength,
      Constants.BUFFER_CREATIONFLAG_READWRITE,
      "OS GPU signal parameters",
    );
    this.params.update(this.parameterData);

    this.compute = new ComputeShader(
      "os-gpu-signal-field",
      engine,
      { computeSource: SIGNAL_FIELD_WGSL },
      {
        bindingsMapping: {
          particles: { group: 0, binding: 0 },
          params: { group: 0, binding: 1 },
        },
      },
    );
    this.compute.setStorageBuffer("particles", this.particles);
    this.compute.setStorageBuffer("params", this.params);
    this.compute.onCompiled = () => {
      this.ready = true;
      this.compute.fastMode = true;
    };
    this.compute.onError = (_effect, errors) => {
      this.ready = false;
      console.error("OS GPU signal field shader compilation failed.", errors);
    };

    this.vertexBuffer = new VertexBuffer(
      engine,
      this.particles.getBuffer(),
      VertexBuffer.PositionKind,
      false,
      false,
      4,
      false,
      0,
      3,
    );

    this.mesh = new Mesh("os-gpu-signal-field-mesh", scene);
    this.mesh.setVerticesBuffer(this.vertexBuffer, false);
    this.mesh.isUnIndexed = true;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;

    this.material = new StandardMaterial("os-gpu-signal-field-material", scene);
    this.material.disableLighting = true;
    this.material.pointsCloud = true;
    this.material.pointSize = Math.max(0.6, options.pointSize);
    this.material.emissiveColor = options.gold.scale(0.82);
    this.material.diffuseColor = options.gold.scale(0.08);
    this.material.alpha = 0.32;
    this.material.backFaceCulling = false;
    this.mesh.material = this.material;
  }

  setColor(gold: Color3) {
    this.material.emissiveColor = gold.scale(0.82);
    this.material.diffuseColor = gold.scale(0.08);
  }

  setVisible(visible: boolean) {
    this.mesh.setEnabled(visible);
  }

  tick(timeSeconds: number, activity: number, motion: number, workspaceId: WorkspaceId) {
    const delta = this.lastTime === 0 ? 1 / 60 : Math.min(0.1, Math.max(0, timeSeconds - this.lastTime));
    this.lastTime = timeSeconds;

    this.parameterData[0] = timeSeconds;
    this.parameterData[1] = delta;
    this.parameterData[2] = this.count;
    this.parameterData[3] = activity;
    this.parameterData[4] = motion;
    this.parameterData[5] = workspaceIndex(workspaceId);
    this.parameterData[6] = this.radius;
    this.parameterData[7] = this.vertical;
    this.params.update(this.parameterData);

    if (!this.ready && !this.compute.isReady()) return;
    this.ready = true;
    this.compute.fastMode = true;
    this.compute.dispatch(Math.ceil(this.count / WORKGROUP_SIZE), 1, 1);
  }

  dispose() {
    this.mesh.dispose(false, true);
    this.material.dispose();
    this.vertexBuffer.dispose();
    this.particles.dispose();
    this.params.dispose();
    // ComputeShader currently owns no explicit dispose() method; its GPU context is released with the engine.
    void this.engine;
  }
}
