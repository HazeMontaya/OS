export type RenderQuality = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";

export type RenderProfile = {
  label: string;
  resolutionScale: number;
  particleBudget: number;
  maxVisibleNodes: number;
  shadowQuality: 0 | 1 | 2 | 3;
  postProcessing: boolean;
  antialiasing: "none" | "fxaa" | "taa";
};

export const RENDER_PROFILES: Record<RenderQuality, RenderProfile> = {
  LOW: {
    label: "LOW",
    resolutionScale: 0.72,
    particleBudget: 8_000,
    maxVisibleNodes: 2_500,
    shadowQuality: 0,
    postProcessing: false,
    antialiasing: "none",
  },
  MEDIUM: {
    label: "MEDIUM",
    resolutionScale: 0.86,
    particleBudget: 24_000,
    maxVisibleNodes: 8_000,
    shadowQuality: 1,
    postProcessing: true,
    antialiasing: "fxaa",
  },
  HIGH: {
    label: "HIGH",
    resolutionScale: 1,
    particleBudget: 64_000,
    maxVisibleNodes: 24_000,
    shadowQuality: 2,
    postProcessing: true,
    antialiasing: "fxaa",
  },
  ULTRA: {
    label: "ULTRA",
    resolutionScale: 1,
    particleBudget: 160_000,
    maxVisibleNodes: 64_000,
    shadowQuality: 3,
    postProcessing: true,
    antialiasing: "taa",
  },
};
