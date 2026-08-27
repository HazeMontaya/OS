import { useEffect, useState } from "react";
import { OS_THEMES, type OsThemeId } from "@os/design-system";
import type { RenderQuality } from "@os/renderer";

export type { OsThemeId, RenderQuality };
export type InterfaceDensity = "COMPACT" | "BALANCED" | "SPACIOUS";

export type OsSettings = {
  version: 2;
  themeId: OsThemeId;
  interfaceDensity: InterfaceDensity;
  telemetryVisible: boolean;
  analyticsDefaultOpen: boolean;
  reducedMotion: boolean;
  adaptiveQuality: boolean;
  cinematicGrain: boolean;
  animationIntensity: number;
  panelOpacity: number;
  renderQuality: RenderQuality;
  glowIntensity: number;
  labelDensity: number;
  graphDensity: number;
  edgeIntensity: number;
  depthFog: number;
  ambientParticles: number;
  targetFps: 30 | 60 | 120;
};

const STORAGE_KEY = "os.desktop.settings.v2";
const LEGACY_STORAGE_KEY = "os.desktop.settings.v1";

export const defaultOsSettings: OsSettings = {
  version: 2,
  themeId: "OBSIDIAN_GOLD",
  interfaceDensity: "BALANCED",
  telemetryVisible: true,
  analyticsDefaultOpen: true,
  reducedMotion: false,
  adaptiveQuality: true,
  cinematicGrain: true,
  animationIntensity: 0.9,
  panelOpacity: 0.78,
  renderQuality: "HIGH",
  glowIntensity: 1.05,
  labelDensity: 0.72,
  graphDensity: 1,
  edgeIntensity: 0.82,
  depthFog: 1,
  ambientParticles: 0.72,
  targetFps: 60,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSettings(candidate: Partial<OsSettings>): OsSettings {
  const themeId = candidate.themeId && candidate.themeId in OS_THEMES
    ? candidate.themeId
    : defaultOsSettings.themeId;
  const renderQuality = ["LOW", "MEDIUM", "HIGH", "ULTRA"].includes(candidate.renderQuality ?? "")
    ? candidate.renderQuality as RenderQuality
    : defaultOsSettings.renderQuality;
  const targetFps = [30, 60, 120].includes(candidate.targetFps ?? 0)
    ? candidate.targetFps as 30 | 60 | 120
    : defaultOsSettings.targetFps;

  return {
    ...defaultOsSettings,
    ...candidate,
    version: 2,
    themeId,
    renderQuality,
    targetFps,
    animationIntensity: clamp(candidate.animationIntensity ?? defaultOsSettings.animationIntensity, 0, 1.5),
    panelOpacity: clamp(candidate.panelOpacity ?? defaultOsSettings.panelOpacity, 0.38, 0.96),
    glowIntensity: clamp(candidate.glowIntensity ?? defaultOsSettings.glowIntensity, 0, 2),
    labelDensity: clamp(candidate.labelDensity ?? defaultOsSettings.labelDensity, 0, 1),
    graphDensity: clamp(candidate.graphDensity ?? defaultOsSettings.graphDensity, 0.25, 1.5),
    edgeIntensity: clamp(candidate.edgeIntensity ?? defaultOsSettings.edgeIntensity, 0, 1.5),
    depthFog: clamp(candidate.depthFog ?? defaultOsSettings.depthFog, 0, 1.5),
    ambientParticles: clamp(candidate.ambientParticles ?? defaultOsSettings.ambientParticles, 0, 1.5),
  };
}

function readStoredSettings(): OsSettings {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeSettings(JSON.parse(current) as Partial<OsSettings>);

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = normalizeSettings(JSON.parse(legacy) as Partial<OsSettings>);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // Corrupt settings never block OS startup; defaults are deterministic.
  }
  return defaultOsSettings;
}

export function useOsSettings() {
  const [settings, setSettings] = useState<OsSettings>(readStoredSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const patchSettings = (patch: Partial<OsSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...patch }));
  };

  const resetSettings = () => setSettings(defaultOsSettings);

  return { settings, patchSettings, resetSettings };
}
