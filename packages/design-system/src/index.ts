export type OsThemeId =
  | "OBSIDIAN_GOLD"
  | "IMPERIAL_BLACK"
  | "CARBON_BRASS"
  | "NOIR_CHAMPAGNE";

export type OsTheme = {
  id: OsThemeId;
  label: string;
  description: string;
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceSoft: string;
  border: string;
  borderStrong: string;
  gold: string;
  goldBright: string;
  goldSoft: string;
  bronze: string;
  text: string;
  textMuted: string;
  textFaint: string;
  success: string;
  warning: string;
  danger: string;
};

export const OS_THEMES: Record<OsThemeId, OsTheme> = {
  OBSIDIAN_GOLD: {
    id: "OBSIDIAN_GOLD",
    label: "Obsidian Gold",
    description: "Near-black obsidian, warm architectural gold and restrained champagne highlights.",
    canvas: "#030303",
    surface: "#080706",
    surfaceRaised: "#0f0c08",
    surfaceSoft: "#151006",
    border: "rgba(215, 179, 90, 0.16)",
    borderStrong: "rgba(244, 216, 135, 0.34)",
    gold: "#d7b35a",
    goldBright: "#f4d887",
    goldSoft: "#ffe8ae",
    bronze: "#8f6730",
    text: "#f4efe4",
    textMuted: "#b9aa8a",
    textFaint: "#776d5a",
    success: "#c9d89b",
    warning: "#e6af54",
    danger: "#d56f47",
  },
  IMPERIAL_BLACK: {
    id: "IMPERIAL_BLACK",
    label: "Imperial Black",
    description: "Hard black, high-contrast royal gold and brighter signal highlights.",
    canvas: "#010101",
    surface: "#070603",
    surfaceRaised: "#100c04",
    surfaceSoft: "#171005",
    border: "rgba(232, 188, 71, 0.18)",
    borderStrong: "rgba(255, 218, 112, 0.40)",
    gold: "#e2b840",
    goldBright: "#ffdb72",
    goldSoft: "#ffe8a0",
    bronze: "#94631f",
    text: "#fff7e5",
    textMuted: "#c0a875",
    textFaint: "#7c6a49",
    success: "#c9d98a",
    warning: "#f0ad35",
    danger: "#db6c3c",
  },
  CARBON_BRASS: {
    id: "CARBON_BRASS",
    label: "Carbon Brass",
    description: "Carbon surfaces with muted brass for long technical sessions and dense telemetry.",
    canvas: "#050504",
    surface: "#0b0a08",
    surfaceRaised: "#12100c",
    surfaceSoft: "#18150f",
    border: "rgba(184, 150, 82, 0.16)",
    borderStrong: "rgba(210, 179, 110, 0.32)",
    gold: "#b89a56",
    goldBright: "#d8ba72",
    goldSoft: "#ead39b",
    bronze: "#7d6235",
    text: "#e9e3d7",
    textMuted: "#aaa08b",
    textFaint: "#6e685b",
    success: "#b6c58e",
    warning: "#c99452",
    danger: "#bd684a",
  },
  NOIR_CHAMPAGNE: {
    id: "NOIR_CHAMPAGNE",
    label: "Noir Champagne",
    description: "Soft black with pale champagne-gold for presentation and cinematic focus states.",
    canvas: "#030302",
    surface: "#090806",
    surfaceRaised: "#110f0b",
    surfaceSoft: "#17140e",
    border: "rgba(225, 205, 159, 0.16)",
    borderStrong: "rgba(255, 235, 190, 0.34)",
    gold: "#d9c18b",
    goldBright: "#f0dba8",
    goldSoft: "#fff0c8",
    bronze: "#8e7751",
    text: "#f7f2e9",
    textMuted: "#bcb09a",
    textFaint: "#766e60",
    success: "#c8d4a6",
    warning: "#dcae63",
    danger: "#c97a5b",
  },
};

export const OS_SEMANTIC_GOLD = {
  core: "#fff0b0",
  actor: "#d6bd79",
  episodicMemory: "#b99249",
  semanticMemory: "#d1aa52",
  stableMemory: "#e1c477",
  model: "#f1ce72",
  agent: "#e3b85b",
  tool: "#b98237",
  goal: "#f2d08a",
  project: "#c99c48",
  historical: "#6b5b3d",
  danger: "#c7663d",
} as const;

export const OS_TOKENS = {
  space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32, xxl: 48 },
  radius: { control: 8, panel: 14, spatial: 24, capsule: 999 },
  motion: { instant: 90, fast: 160, normal: 280, semantic: 520, cinematic: 900 },
  depth: { near: 4, mid: 12, deep: 28, background: 64, abyss: 120 },
  typography: {
    ui: '"Segoe UI Variable", "Inter", "Segoe UI", sans-serif',
    display: '"Segoe UI Variable Display", "Segoe UI", sans-serif',
    mono: '"Cascadia Code", "JetBrains Mono", "Cascadia Mono", monospace',
  },
  color: OS_SEMANTIC_GOLD,
} as const;

export type OsDesignTokens = typeof OS_TOKENS;

export function getTheme(id: OsThemeId): OsTheme {
  return OS_THEMES[id] ?? OS_THEMES.OBSIDIAN_GOLD;
}

export function themeCssVariables(id: OsThemeId): Record<string, string> {
  const theme = getTheme(id);
  return {
    "--os-canvas": theme.canvas,
    "--os-surface": theme.surface,
    "--os-surface-raised": theme.surfaceRaised,
    "--os-surface-soft": theme.surfaceSoft,
    "--os-border": theme.border,
    "--os-border-strong": theme.borderStrong,
    "--os-gold": theme.gold,
    "--os-gold-bright": theme.goldBright,
    "--os-gold-soft": theme.goldSoft,
    "--os-bronze": theme.bronze,
    "--os-text": theme.text,
    "--os-text-muted": theme.textMuted,
    "--os-text-faint": theme.textFaint,
    "--os-success": theme.success,
    "--os-warning": theme.warning,
    "--os-danger": theme.danger,
  };
}
