import { useEffect, useState } from "react";

export type RenderQuality = "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
export type InterfaceDensity = "COMPACT" | "BALANCED" | "SPACIOUS";

export type OsSettings = {
  version: 1;
  interfaceDensity: InterfaceDensity;
  telemetryVisible: boolean;
  analyticsDefaultOpen: boolean;
  reducedMotion: boolean;
  animationIntensity: number;
  panelOpacity: number;
  renderQuality: RenderQuality;
  glowIntensity: number;
  labelDensity: number;
  graphDensity: number;
  targetFps: 30 | 60 | 120;
};

const STORAGE_KEY = "os.desktop.settings.v1";

export const defaultOsSettings: OsSettings = {
  version: 1,
  interfaceDensity: "BALANCED",
  telemetryVisible: true,
  analyticsDefaultOpen: true,
  reducedMotion: false,
  animationIntensity: 1,
  panelOpacity: 0.72,
  renderQuality: "HIGH",
  glowIntensity: 1,
  labelDensity: 0.8,
  graphDensity: 1,
  targetFps: 60,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSettings(candidate: Partial<OsSettings>): OsSettings {
  return {
    ...defaultOsSettings,
    ...candidate,
    version: 1,
    animationIntensity: clamp(candidate.animationIntensity ?? defaultOsSettings.animationIntensity, 0, 1.5),
    panelOpacity: clamp(candidate.panelOpacity ?? defaultOsSettings.panelOpacity, 0.35, 0.96),
    glowIntensity: clamp(candidate.glowIntensity ?? defaultOsSettings.glowIntensity, 0, 2),
    labelDensity: clamp(candidate.labelDensity ?? defaultOsSettings.labelDensity, 0, 1),
    graphDensity: clamp(candidate.graphDensity ?? defaultOsSettings.graphDensity, 0.25, 1.5),
  };
}

export function useOsSettings() {
  const [settings, setSettings] = useState<OsSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? normalizeSettings(JSON.parse(stored) as Partial<OsSettings>) : defaultOsSettings;
    } catch {
      return defaultOsSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const patchSettings = (patch: Partial<OsSettings>) => {
    setSettings((current) => normalizeSettings({ ...current, ...patch }));
  };

  const resetSettings = () => setSettings(defaultOsSettings);

  return { settings, patchSettings, resetSettings };
}
