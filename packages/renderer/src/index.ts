export type RenderQuality = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export type RenderBackend = "WEBGPU" | "WEBGL";
export type GpuFeatureTier = "WEBGL_BATCHED" | "WEBGPU_COMPUTE";

export type RenderProfile = {
  label: string;
  resolutionScale: number;
  particleBudget: number;
  maxVisibleNodes: number;
  maxVisibleEdges: number;
  labelBudget: number;
  pickProxyBudget: number;
  sphereSegments: number;
  shadowQuality: 0 | 1 | 2 | 3;
  postProcessing: boolean;
  antialiasing: "none" | "fxaa" | "taa";
  bloomScale: number;
  adaptiveFloorScale: number;
};

export type RenderBudget = {
  nodes: number;
  edges: number;
  labels: number;
  pickProxies: number;
  ambientSignals: number;
};

export type GpuPipelineStatus = {
  backend: RenderBackend;
  tier: GpuFeatureTier;
  computeShaders: boolean;
  sharedStorageVertexBuffer: boolean;
  signalParticleBudget: number;
};

export const RENDER_PROFILES: Record<RenderQuality, RenderProfile> = {
  LOW: {
    label: "LOW",
    resolutionScale: 0.70,
    particleBudget: 8_000,
    maxVisibleNodes: 2_500,
    maxVisibleEdges: 5_000,
    labelBudget: 18,
    pickProxyBudget: 64,
    sphereSegments: 6,
    shadowQuality: 0,
    postProcessing: false,
    antialiasing: "none",
    bloomScale: 0.58,
    adaptiveFloorScale: 0.58,
  },
  MEDIUM: {
    label: "MEDIUM",
    resolutionScale: 0.84,
    particleBudget: 24_000,
    maxVisibleNodes: 8_000,
    maxVisibleEdges: 16_000,
    labelBudget: 36,
    pickProxyBudget: 128,
    sphereSegments: 8,
    shadowQuality: 1,
    postProcessing: true,
    antialiasing: "fxaa",
    bloomScale: 0.76,
    adaptiveFloorScale: 0.68,
  },
  HIGH: {
    label: "HIGH",
    resolutionScale: 1,
    particleBudget: 64_000,
    maxVisibleNodes: 24_000,
    maxVisibleEdges: 48_000,
    labelBudget: 72,
    pickProxyBudget: 256,
    sphereSegments: 10,
    shadowQuality: 2,
    postProcessing: true,
    antialiasing: "fxaa",
    bloomScale: 0.92,
    adaptiveFloorScale: 0.74,
  },
  ULTRA: {
    label: "ULTRA",
    resolutionScale: 1,
    particleBudget: 160_000,
    maxVisibleNodes: 64_000,
    maxVisibleEdges: 120_000,
    labelBudget: 128,
    pickProxyBudget: 384,
    sphereSegments: 12,
    shadowQuality: 3,
    postProcessing: true,
    antialiasing: "taa",
    bloomScale: 1.08,
    adaptiveFloorScale: 0.78,
  },
};

export function resolveRenderBudget(
  profile: RenderProfile,
  graphDensity: number,
  labelDensity: number,
  ambientIntensity: number,
): RenderBudget {
  const density = Math.max(0.25, Math.min(1.5, graphDensity));
  const labelScale = Math.max(0, Math.min(1, labelDensity));
  const ambientScale = Math.max(0, Math.min(1.5, ambientIntensity));

  return {
    nodes: Math.max(1, Math.floor(profile.maxVisibleNodes * density)),
    edges: Math.max(0, Math.floor(profile.maxVisibleEdges * density)),
    labels: Math.max(0, Math.floor(profile.labelBudget * labelScale)),
    pickProxies: Math.max(16, Math.floor(profile.pickProxyBudget * Math.min(1.25, density))),
    // SPS is the compatibility fallback. The WebGPU compute field receives its own much larger budget.
    ambientSignals: Math.max(0, Math.min(900, Math.floor(profile.particleBudget * 0.018 * ambientScale))),
  };
}

export function resolveGpuSignalBudget(
  profile: RenderProfile,
  ambientIntensity: number,
  computeSupported: boolean,
): number {
  if (!computeSupported) return 0;
  const ambientScale = Math.max(0, Math.min(1.5, ambientIntensity));
  const base = profile.particleBudget * 0.5 * ambientScale;
  return Math.max(512, Math.min(96_000, Math.floor(base)));
}

export function describeGpuPipeline(
  backend: RenderBackend,
  computeSupported: boolean,
  profile: RenderProfile,
  ambientIntensity: number,
): GpuPipelineStatus {
  const compute = backend === "WEBGPU" && computeSupported;
  return {
    backend,
    tier: compute ? "WEBGPU_COMPUTE" : "WEBGL_BATCHED",
    computeShaders: compute,
    sharedStorageVertexBuffer: compute,
    signalParticleBudget: resolveGpuSignalBudget(profile, ambientIntensity, compute),
  };
}

export type AdaptiveRenderState = {
  requestedScale: number;
  effectiveScale: number;
  targetFps: number;
  measuredFps: number;
};

export function adaptiveResolutionScale(
  current: AdaptiveRenderState,
  profile: RenderProfile,
): number {
  if (!Number.isFinite(current.measuredFps) || current.measuredFps <= 0) {
    return current.effectiveScale;
  }

  const lowThreshold = current.targetFps * 0.82;
  const highThreshold = current.targetFps * 0.97;
  let next = current.effectiveScale;

  if (current.measuredFps < lowThreshold) next -= 0.06;
  if (current.measuredFps > highThreshold) next += 0.025;

  return Math.max(
    profile.adaptiveFloorScale,
    Math.min(current.requestedScale, Math.round(next * 1000) / 1000),
  );
}
