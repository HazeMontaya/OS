import { OS_THEMES, type OsThemeId } from "@os/design-system";
import type { OsSettings, InterfaceDensity, RenderQuality } from "./useOsSettings";
import "./settings.css";

type Props = {
  settings: OsSettings;
  onChange: (patch: Partial<OsSettings>) => void;
  onReset: () => void;
  onClose: () => void;
};

const qualities: RenderQuality[] = ["LOW", "MEDIUM", "HIGH", "ULTRA"];
const densities: InterfaceDensity[] = ["COMPACT", "BALANCED", "SPACIOUS"];
const themes = Object.values(OS_THEMES);

export default function SettingsPanel({ settings, onChange, onReset, onClose }: Props) {
  return (
    <aside className="settings-panel glass" aria-label="OS settings">
      <header className="settings-header">
        <div>
          <p className="eyebrow">BLACK · GOLD SYSTEM</p>
          <h2>Configuration Chamber</h2>
        </div>
        <button type="button" className="settings-close" onClick={onClose}>CLOSE</button>
      </header>

      <section className="settings-section">
        <div className="settings-section-title">
          <span>IDENTITY</span>
          <small>One black-gold language, multiple calibrated expressions</small>
        </div>

        <label className="settings-field">
          <span>Theme</span>
          <select
            value={settings.themeId}
            onChange={(event) => onChange({ themeId: event.target.value as OsThemeId })}
          >
            {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
        </label>
        <p className="settings-note">{OS_THEMES[settings.themeId].description}</p>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <span>EXPERIENCE</span>
          <small>Persistent desktop behavior</small>
        </div>

        <label className="settings-field">
          <span>Interface density</span>
          <select
            value={settings.interfaceDensity}
            onChange={(event) => onChange({ interfaceDensity: event.target.value as InterfaceDensity })}
          >
            {densities.map((density) => <option key={density}>{density}</option>)}
          </select>
        </label>

        <label className="settings-field settings-toggle">
          <span>Telemetry overlay</span>
          <input type="checkbox" checked={settings.telemetryVisible} onChange={(event) => onChange({ telemetryVisible: event.target.checked })} />
        </label>

        <label className="settings-field settings-toggle">
          <span>Analytics on launch</span>
          <input type="checkbox" checked={settings.analyticsDefaultOpen} onChange={(event) => onChange({ analyticsDefaultOpen: event.target.checked })} />
        </label>

        <label className="settings-field settings-toggle">
          <span>Reduced motion</span>
          <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => onChange({ reducedMotion: event.target.checked })} />
        </label>

        <label className="settings-field settings-toggle">
          <span>Cinematic grain</span>
          <input type="checkbox" checked={settings.cinematicGrain} onChange={(event) => onChange({ cinematicGrain: event.target.checked })} />
        </label>

        <label className="settings-field settings-range">
          <span>Animation intensity <b>{settings.animationIntensity.toFixed(2)}×</b></span>
          <input type="range" min="0" max="1.5" step="0.05" value={settings.animationIntensity} onChange={(event) => onChange({ animationIntensity: Number(event.target.value) })} />
        </label>

        <label className="settings-field settings-range">
          <span>Panel opacity <b>{Math.round(settings.panelOpacity * 100)}%</b></span>
          <input type="range" min="0.38" max="0.96" step="0.01" value={settings.panelOpacity} onChange={(event) => onChange({ panelOpacity: Number(event.target.value) })} />
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <span>GPU RENDERER</span>
          <small>Adaptive quality and scene budgets</small>
        </div>

        <label className="settings-field">
          <span>Quality profile</span>
          <select value={settings.renderQuality} onChange={(event) => onChange({ renderQuality: event.target.value as RenderQuality })}>
            {qualities.map((quality) => <option key={quality}>{quality}</option>)}
          </select>
        </label>

        <label className="settings-field">
          <span>Target FPS</span>
          <select value={settings.targetFps} onChange={(event) => onChange({ targetFps: Number(event.target.value) as 30 | 60 | 120 })}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </label>

        <label className="settings-field settings-toggle">
          <span>Adaptive resolution</span>
          <input type="checkbox" checked={settings.adaptiveQuality} onChange={(event) => onChange({ adaptiveQuality: event.target.checked })} />
        </label>

        <label className="settings-field settings-range">
          <span>Gold bloom <b>{settings.glowIntensity.toFixed(2)}×</b></span>
          <input type="range" min="0" max="2" step="0.05" value={settings.glowIntensity} onChange={(event) => onChange({ glowIntensity: Number(event.target.value) })} />
        </label>

        <label className="settings-field settings-range">
          <span>Label density <b>{Math.round(settings.labelDensity * 100)}%</b></span>
          <input type="range" min="0" max="1" step="0.05" value={settings.labelDensity} onChange={(event) => onChange({ labelDensity: Number(event.target.value) })} />
        </label>

        <label className="settings-field settings-range">
          <span>Graph density <b>{settings.graphDensity.toFixed(2)}×</b></span>
          <input type="range" min="0.25" max="1.5" step="0.05" value={settings.graphDensity} onChange={(event) => onChange({ graphDensity: Number(event.target.value) })} />
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <span>SPATIAL SIGNAL</span>
          <small>Depth, relation and atmospheric behavior</small>
        </div>

        <label className="settings-field settings-range">
          <span>Relation intensity <b>{settings.edgeIntensity.toFixed(2)}×</b></span>
          <input type="range" min="0" max="1.5" step="0.05" value={settings.edgeIntensity} onChange={(event) => onChange({ edgeIntensity: Number(event.target.value) })} />
        </label>

        <label className="settings-field settings-range">
          <span>Depth fog <b>{settings.depthFog.toFixed(2)}×</b></span>
          <input type="range" min="0" max="1.5" step="0.05" value={settings.depthFog} onChange={(event) => onChange({ depthFog: Number(event.target.value) })} />
        </label>

        <label className="settings-field settings-range">
          <span>Ambient field <b>{settings.ambientParticles.toFixed(2)}×</b></span>
          <input type="range" min="0" max="1.5" step="0.05" value={settings.ambientParticles} onChange={(event) => onChange({ ambientParticles: Number(event.target.value) })} />
        </label>
      </section>

      <footer className="settings-footer">
        <span>Profile v{settings.version} · deterministic local persistence</span>
        <button type="button" onClick={onReset}>RESET</button>
      </footer>
    </aside>
  );
}
