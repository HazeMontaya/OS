export const DESIGN = {
  colors: {
    bg: '#0a0a0f',
    bgDeep: '#050508',
    bgPanel: 'rgba(12, 12, 20, 0.85)',
    bgPanelHover: 'rgba(20, 20, 35, 0.9)',
    border: 'rgba(100, 120, 255, 0.12)',
    borderActive: 'rgba(100, 160, 255, 0.4)',
    text: '#e8eaf6',
    textSecondary: '#8892b0',
    textMuted: '#5a6380',
    accent: '#6488ff',
    accentGlow: 'rgba(100, 136, 255, 0.3)',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    agent: '#a78bfa',
    tool: '#34d399',
    memory: '#f472b6',
    model: '#60a5fa',
    task: '#fbbf24',
    workflow: '#fb923c',
    file: '#94a3b8',
    concept: '#c084fc',
    node: {
      agent: '#a78bfa',
      tool: '#34d399',
      memory: '#f472b6',
      model: '#60a5fa',
      task: '#fbbf24',
      workflow: '#fb923c',
      file: '#94a3b8',
      concept: '#c084fc',
      process: '#22d3ee',
      default: '#6488ff',
    }
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    monoFamily: "'JetBrains Mono', 'Fira Code', monospace",
    sizes: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 28, title: 36 },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  glass: {
    bg: 'rgba(12, 12, 20, 0.7)',
    blur: 20,
    border: '1px solid rgba(100, 120, 255, 0.1)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
    spring: { tension: 120, friction: 14 },
  },
  void: {
    nodeSize: { min: 0.3, max: 2.0, default: 0.8 },
    edgeWidth: { min: 0.02, max: 0.15, default: 0.05 },
    spacing: 8,
    depth: 50,
    particleCount: 2000,
    ambientIntensity: 0.3,
    pulseSpeed: 0.002,
  },
};

export function getNodeColor(type) { return DESIGN.colors.node[type] || DESIGN.colors.node.default; }
export function getNodeSize(type, importance = 0.5) {
  const base = DESIGN.void.nodeSize;
  return base.min + (base.max - base.min) * importance;
}
export function getGlassStyle() {
  return { background: DESIGN.glass.bg, backdropFilter: `blur(${DESIGN.glass.blur}px)`, border: DESIGN.glass.border, boxShadow: DESIGN.glass.shadow, borderRadius: `${DESIGN.radius.lg}px` };
}
