import type { SemanticZoomLevel } from "@os/visualization";
import { StorageBuffer } from "@babylonjs/core/Buffers/storageBuffer";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ComputeShader } from "@babylonjs/core/Compute/computeShader";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

const WORKGROUP_SIZE = 64;
const NODE_SOURCE_FLOATS = 12;
const EDGE_SOURCE_FLOATS = 8;
const NODE_RENDER_FLOATS = 8;
const EDGE_RENDER_FLOATS = 16;
const PARAM_FLOATS = 16;
const HIDDEN_COORDINATE = 1_000_000;

const GPU_GRAPH_WGSL = /* wgsl */ `
struct NodeRecord {
  positionSize: vec4<f32>,
  colorConfidence: vec4<f32>,
  meta: vec4<f32>,
};

struct EdgeRecord {
  endpoints: vec4<f32>,
  colorWeight: vec4<f32>,
};

struct Params {
  focus: vec4<f32>,
  render: vec4<f32>,
  lod: vec4<f32>,
  counts: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> nodes: array<NodeRecord>;
@group(0) @binding(1) var<storage, read> edges: array<EdgeRecord>;
@group(0) @binding(2) var<storage, read_write> nodeRender: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> edgeRender: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> params: Params;

fn hiddenPosition() -> vec4<f32> {
  return vec4<f32>(${HIDDEN_COORDINATE}.0, ${HIDDEN_COORDINATE}.0, ${HIDDEN_COORDINATE}.0, 1.0);
}

fn nodeThreshold(zoom: u32) -> f32 {
  if (zoom == 0u) { return 2.0; }
  if (zoom == 1u) { return 0.82; }
  if (zoom == 2u) { return 0.22; }
  if (zoom == 3u) { return 0.06; }
  return 0.0;
}

fn edgeThreshold(zoom: u32) -> f32 {
  if (zoom <= 1u) { return 2.0; }
  if (zoom == 2u) { return 0.52; }
  if (zoom == 3u) { return 0.18; }
  return 0.0;
}

fn nodeIsVisible(record: NodeRecord, index: u32) -> bool {
  let zoom = u32(params.render.x + 0.5);
  let selectedPlusOne = u32(params.render.w + 0.5);
  let isSelected = selectedPlusOne == index + 1u;
  let isCore = record.meta.y > 0.5;
  if (isSelected || isCore) { return true; }
  if (record.meta.x < nodeThreshold(zoom)) { return false; }

  let maximumDistance = max(8.0, params.focus.w * params.lod.z);
  return distance(record.positionSize.xyz, params.focus.xyz) <= maximumDistance;
}

fn writeHiddenNode(index: u32) {
  let base = index * 2u;
  nodeRender[base] = hiddenPosition();
  nodeRender[base + 1u] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

fn renderNode(index: u32) {
  let record = nodes[index];
  if (!nodeIsVisible(record, index)) {
    writeHiddenNode(index);
    return;
  }

  let selectedPlusOne = u32(params.render.w + 0.5);
  let selected = selectedPlusOne == index + 1u;
  let confidence = clamp(record.colorConfidence.w, 0.0, 1.0);
  let importance = clamp(record.meta.x, 0.0, 1.0);
  let pulse = 1.0 + sin(params.counts.z * 2.8 + f32(index) * 0.013) * 0.018 * params.counts.w;
  let alpha = select(clamp(0.28 + confidence * 0.46 + importance * 0.20, 0.18, 0.94), 1.0, selected);
  let base = index * 2u;
  nodeRender[base] = vec4<f32>(record.positionSize.xyz * pulse, record.positionSize.w);
  nodeRender[base + 1u] = vec4<f32>(record.colorConfidence.xyz, alpha);
}

fn writeHiddenEdge(index: u32) {
  let base = index * 4u;
  let hidden = hiddenPosition();
  edgeRender[base] = hidden;
  edgeRender[base + 1u] = vec4<f32>(0.0);
  edgeRender[base + 2u] = hidden;
  edgeRender[base + 3u] = vec4<f32>(0.0);
}

fn renderEdge(index: u32) {
  let zoom = u32(params.render.x + 0.5);
  if (params.render.y < 0.5) {
    writeHiddenEdge(index);
    return;
  }

  let edge = edges[index];
  let fromIndex = u32(edge.endpoints.x + 0.5);
  let toIndex = u32(edge.endpoints.y + 0.5);
  let nodeCount = u32(params.counts.x + 0.5);
  if (fromIndex >= nodeCount || toIndex >= nodeCount || edge.colorWeight.w < edgeThreshold(zoom)) {
    writeHiddenEdge(index);
    return;
  }

  let from = nodes[fromIndex];
  let to = nodes[toIndex];
  if (!nodeIsVisible(from, fromIndex) || !nodeIsVisible(to, toIndex)) {
    writeHiddenEdge(index);
    return;
  }

  let alpha = clamp(0.055 + edge.colorWeight.w * 0.38, 0.04, 0.46);
  let color = vec4<f32>(edge.colorWeight.xyz, alpha);
  let base = index * 4u;
  edgeRender[base] = vec4<f32>(from.positionSize.xyz, 1.0);
  edgeRender[base + 1u] = color;
  edgeRender[base + 2u] = vec4<f32>(to.positionSize.xyz, 1.0);
  edgeRender[base + 3u] = color;
}

@compute @workgroup_size(${WORKGROUP_SIZE}, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  let nodeCount = u32(params.counts.x + 0.5);
  let edgeCount = u32(params.counts.y + 0.5);
  if (index < nodeCount) { renderNode(index); }
  if (index < edgeCount) { renderEdge(index); }
}
`;

function zoomIndex(level: SemanticZoomLevel): number {
  switch (level) {
    case "universe": return 0;
    case "cluster": return 1;
    case "network": return 2;
    case "detail": return 3;
    case "inspect": return 4;
    default: return 2;
  }
}

export type GpuGraphNode = {
  id: string;
  position: Vector3;
  size: number;
  color: Color3;
  importance: number;
  confidence: number;
  core: boolean;
};

export type GpuGraphEdge = {
  id: string;
  from: string;
  to: string;
  color: Color3;
  weight: number;
};

export type GpuGraphFieldOptions = {
  nodes: GpuGraphNode[];
  edges: GpuGraphEdge[];
  pointSize: number;
  distanceMultiplier?: number;
};

/**
 * GPU-resident cognitive graph projection for WebGPU.
 *
 * Topology is packed into storage buffers once. A WGSL compute pass evaluates semantic LOD and
 * focus-distance visibility every frame, then writes directly into storage buffers that are also
 * bound as Babylon vertex/color buffers. No per-frame graph positions or visibility flags are read
 * back to JavaScript. The CPU projection remains the deterministic compatibility path for WebGL.
 */
export class GpuGraphField {
  readonly nodeCount: number;
  readonly edgeCount: number;
  private readonly engine: WebGPUEngine;
  private readonly nodeSource: StorageBuffer;
  private readonly edgeSource: StorageBuffer;
  private readonly nodeRender: StorageBuffer;
  private readonly edgeRender: StorageBuffer;
  private readonly params: StorageBuffer;
  private readonly compute: ComputeShader;
  private readonly nodePositionBuffer: VertexBuffer;
  private readonly nodeColorBuffer: VertexBuffer;
  private readonly edgePositionBuffer: VertexBuffer;
  private readonly edgeColorBuffer: VertexBuffer;
  private readonly nodeMesh: Mesh;
  private readonly edgeMesh: Mesh;
  private readonly nodeMaterial: StandardMaterial;
  private readonly edgeMaterial: StandardMaterial;
  private readonly nodeIds: string[];
  private readonly edgeIds: string[];
  private readonly nodeIndexById = new Map<string, number>();
  private readonly parameterData = new Float32Array(PARAM_FLOATS);
  private readonly distanceMultiplier: number;
  private ready = false;

  static supported(engine: AbstractEngine): boolean {
    return engine instanceof WebGPUEngine && Boolean(engine.getCaps().supportComputeShaders);
  }

  constructor(engine: AbstractEngine, scene: Scene, options: GpuGraphFieldOptions) {
    if (!GpuGraphField.supported(engine)) {
      throw new Error("GPU graph projection requires Babylon WebGPU compute shader support.");
    }

    this.engine = engine as WebGPUEngine;
    this.nodeCount = options.nodes.length;
    this.edgeCount = options.edges.length;
    this.nodeIds = options.nodes.map((node) => node.id);
    this.edgeIds = options.edges.map((edge) => edge.id);
    this.distanceMultiplier = Math.max(1.2, options.distanceMultiplier ?? 2.25);
    this.nodeIds.forEach((id, index) => this.nodeIndexById.set(id, index));

    const nodeSourceData = this.packNodes(options.nodes);
    const edgeSourceData = this.packEdges(options.edges);
    const nodeRenderData = new Float32Array(Math.max(1, this.nodeCount) * NODE_RENDER_FLOATS);
    const edgeRenderData = new Float32Array(Math.max(1, this.edgeCount) * EDGE_RENDER_FLOATS);

    this.nodeSource = new StorageBuffer(
      this.engine,
      Math.max(16, nodeSourceData.byteLength),
      Constants.BUFFER_CREATIONFLAG_READWRITE,
      "OS GPU graph node source",
    );
    if (nodeSourceData.byteLength > 0) this.nodeSource.update(nodeSourceData);

    this.edgeSource = new StorageBuffer(
      this.engine,
      Math.max(16, edgeSourceData.byteLength),
      Constants.BUFFER_CREATIONFLAG_READWRITE,
      "OS GPU graph edge source",
    );
    if (edgeSourceData.byteLength > 0) this.edgeSource.update(edgeSourceData);

    this.nodeRender = new StorageBuffer(
      this.engine,
      nodeRenderData.byteLength,
      Constants.BUFFER_CREATIONFLAG_READWRITE | Constants.BUFFER_CREATIONFLAG_VERTEX,
      "OS GPU graph node render",
    );
    this.nodeRender.update(nodeRenderData);

    this.edgeRender = new StorageBuffer(
      this.engine,
      edgeRenderData.byteLength,
      Constants.BUFFER_CREATIONFLAG_READWRITE | Constants.BUFFER_CREATIONFLAG_VERTEX,
      "OS GPU graph edge render",
    );
    this.edgeRender.update(edgeRenderData);

    this.params = new StorageBuffer(
      this.engine,
      this.parameterData.byteLength,
      Constants.BUFFER_CREATIONFLAG_READWRITE,
      "OS GPU graph parameters",
    );
    this.params.update(this.parameterData);

    this.compute = new ComputeShader(
      "os-gpu-cognitive-graph",
      this.engine,
      { computeSource: GPU_GRAPH_WGSL },
      {
        bindingsMapping: {
          nodes: { group: 0, binding: 0 },
          edges: { group: 0, binding: 1 },
          nodeRender: { group: 0, binding: 2 },
          edgeRender: { group: 0, binding: 3 },
          params: { group: 0, binding: 4 },
        },
      },
    );
    this.compute.setStorageBuffer("nodes", this.nodeSource);
    this.compute.setStorageBuffer("edges", this.edgeSource);
    this.compute.setStorageBuffer("nodeRender", this.nodeRender);
    this.compute.setStorageBuffer("edgeRender", this.edgeRender);
    this.compute.setStorageBuffer("params", this.params);
    this.compute.onCompiled = () => {
      this.ready = true;
      this.compute.fastMode = true;
    };
    this.compute.onError = (_effect, errors) => {
      this.ready = false;
      console.error("OS GPU cognitive graph shader compilation failed.", errors);
    };

    this.nodePositionBuffer = new VertexBuffer(
      this.engine,
      this.nodeRender.getBuffer(),
      VertexBuffer.PositionKind,
      false,
      false,
      8,
      false,
      0,
      3,
    );
    this.nodeColorBuffer = new VertexBuffer(
      this.engine,
      this.nodeRender.getBuffer(),
      VertexBuffer.ColorKind,
      false,
      false,
      8,
      false,
      4,
      4,
    );

    this.nodeMesh = new Mesh("os-gpu-cognitive-nodes", scene);
    this.nodeMesh.setVerticesBuffer(this.nodePositionBuffer, false);
    this.nodeMesh.setVerticesBuffer(this.nodeColorBuffer, false);
    this.nodeMesh.isUnIndexed = true;
    this.nodeMesh.isPickable = false;
    this.nodeMesh.alwaysSelectAsActiveMesh = true;
    this.nodeMesh.hasVertexAlpha = true;

    this.nodeMaterial = new StandardMaterial("os-gpu-cognitive-node-material", scene);
    this.nodeMaterial.disableLighting = true;
    this.nodeMaterial.pointsCloud = true;
    this.nodeMaterial.pointSize = Math.max(1, options.pointSize);
    this.nodeMaterial.emissiveColor = Color3.White();
    this.nodeMaterial.diffuseColor = Color3.White();
    this.nodeMaterial.alpha = 1;
    this.nodeMaterial.backFaceCulling = false;
    this.nodeMesh.material = this.nodeMaterial;

    this.edgePositionBuffer = new VertexBuffer(
      this.engine,
      this.edgeRender.getBuffer(),
      VertexBuffer.PositionKind,
      false,
      false,
      8,
      false,
      0,
      3,
    );
    this.edgeColorBuffer = new VertexBuffer(
      this.engine,
      this.edgeRender.getBuffer(),
      VertexBuffer.ColorKind,
      false,
      false,
      8,
      false,
      4,
      4,
    );

    this.edgeMesh = new Mesh("os-gpu-cognitive-edges", scene);
    this.edgeMesh.setVerticesBuffer(this.edgePositionBuffer, false);
    this.edgeMesh.setVerticesBuffer(this.edgeColorBuffer, false);
    this.edgeMesh.isUnIndexed = true;
    this.edgeMesh.isPickable = false;
    this.edgeMesh.alwaysSelectAsActiveMesh = true;
    this.edgeMesh.hasVertexAlpha = true;

    this.edgeMaterial = new StandardMaterial("os-gpu-cognitive-edge-material", scene);
    this.edgeMaterial.disableLighting = true;
    this.edgeMaterial.emissiveColor = Color3.White();
    this.edgeMaterial.diffuseColor = Color3.White();
    this.edgeMaterial.alpha = 1;
    this.edgeMaterial.fillMode = Material.LineListDrawMode;
    this.edgeMaterial.backFaceCulling = false;
    this.edgeMesh.material = this.edgeMaterial;
  }

  private packNodes(nodes: GpuGraphNode[]): Float32Array {
    const data = new Float32Array(nodes.length * NODE_SOURCE_FLOATS);
    nodes.forEach((node, index) => {
      const offset = index * NODE_SOURCE_FLOATS;
      data[offset] = node.position.x;
      data[offset + 1] = node.position.y;
      data[offset + 2] = node.position.z;
      data[offset + 3] = Math.max(0.05, node.size);
      data[offset + 4] = node.color.r;
      data[offset + 5] = node.color.g;
      data[offset + 6] = node.color.b;
      data[offset + 7] = Math.max(0, Math.min(1, node.confidence));
      data[offset + 8] = Math.max(0, Math.min(1, node.importance));
      data[offset + 9] = node.core ? 1 : 0;
      data[offset + 10] = 0;
      data[offset + 11] = 0;
    });
    return data;
  }

  private packEdges(edges: GpuGraphEdge[]): Float32Array {
    const data = new Float32Array(edges.length * EDGE_SOURCE_FLOATS);
    edges.forEach((edge, index) => {
      const offset = index * EDGE_SOURCE_FLOATS;
      data[offset] = this.nodeIndexById.get(edge.from) ?? -1;
      data[offset + 1] = this.nodeIndexById.get(edge.to) ?? -1;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      data[offset + 4] = edge.color.r;
      data[offset + 5] = edge.color.g;
      data[offset + 6] = edge.color.b;
      data[offset + 7] = Math.max(0, Math.min(1.5, edge.weight));
    });
    return data;
  }

  updateMutable(nodes: GpuGraphNode[], edges: GpuGraphEdge[]): boolean {
    if (nodes.length !== this.nodeCount || edges.length !== this.edgeCount) return false;
    if (nodes.some((node, index) => node.id !== this.nodeIds[index])) return false;
    if (edges.some((edge, index) => edge.id !== this.edgeIds[index])) return false;

    const nodeData = this.packNodes(nodes);
    const edgeData = this.packEdges(edges);
    if (nodeData.byteLength > 0) this.nodeSource.update(nodeData);
    if (edgeData.byteLength > 0) this.edgeSource.update(edgeData);
    return true;
  }

  setVisible(nodes: boolean, edges: boolean) {
    this.nodeMesh.setEnabled(nodes && this.nodeCount > 0);
    this.edgeMesh.setEnabled(edges && this.edgeCount > 0);
  }

  tick(
    focus: Vector3,
    cameraRadius: number,
    zoom: SemanticZoomLevel,
    selectedNodeId: string | null,
    timeSeconds: number,
    motion: number,
    edgesEnabled: boolean,
  ) {
    this.parameterData[0] = focus.x;
    this.parameterData[1] = focus.y;
    this.parameterData[2] = focus.z;
    this.parameterData[3] = Math.max(2, cameraRadius);
    this.parameterData[4] = zoomIndex(zoom);
    this.parameterData[5] = edgesEnabled ? 1 : 0;
    this.parameterData[6] = 0;
    this.parameterData[7] = selectedNodeId ? (this.nodeIndexById.get(selectedNodeId) ?? -1) + 1 : 0;
    this.parameterData[8] = 0;
    this.parameterData[9] = 0;
    this.parameterData[10] = this.distanceMultiplier;
    this.parameterData[11] = 0;
    this.parameterData[12] = this.nodeCount;
    this.parameterData[13] = this.edgeCount;
    this.parameterData[14] = timeSeconds;
    this.parameterData[15] = Math.max(0, motion);
    this.params.update(this.parameterData);

    if (!this.ready && !this.compute.isReady()) return;
    this.ready = true;
    this.compute.fastMode = true;
    const workItems = Math.max(this.nodeCount, this.edgeCount);
    if (workItems > 0) this.compute.dispatch(Math.ceil(workItems / WORKGROUP_SIZE), 1, 1);
  }

  dispose() {
    this.nodeMesh.dispose(false, false);
    this.edgeMesh.dispose(false, false);
    this.nodeMaterial.dispose();
    this.edgeMaterial.dispose();
    this.nodePositionBuffer.dispose();
    this.nodeColorBuffer.dispose();
    this.edgePositionBuffer.dispose();
    this.edgeColorBuffer.dispose();
    this.nodeSource.dispose();
    this.edgeSource.dispose();
    this.nodeRender.dispose();
    this.edgeRender.dispose();
    this.params.dispose();
  }
}
