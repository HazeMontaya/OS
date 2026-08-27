export const OS_TOKENS = {
  space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
  radius: { control: 8, panel: 16, spatial: 24 },
  motion: { instant: 90, fast: 160, normal: 280, semantic: 520 },
  depth: { near: 4, mid: 12, deep: 28, background: 64 },
  typography: {
    ui: "Inter, Segoe UI, sans-serif",
    mono: "JetBrains Mono, Cascadia Mono, monospace",
  },
} as const;

export type OsDesignTokens = typeof OS_TOKENS;
