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

export default function SettingsPanel({ settings, onChange, onReset, onClose }: Props) {
  return (
    <aside className="settings-panel glass" aria-label="OS settings">
      <header className="settings-header">
        <div>
          <p className="eyebrow">SYSTEM CONFIGURATION</p>
          <h2>Settings Void</h2>
        </div>
        <button type="button" className="settings-close" onClick={onClose}>CLOSE</button>
      </header>

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
          <input
            type="checkbox"
            checked={settings.telemetryVisible}
            onChange={(event) => onChange({ telemetryVisible: event.target.checked })}
          />
        </label>

        <label className="settings-field settings-toggle">
          <span>Analytics open on launch</span>
          <input
            type="checkbox"
            checked={settings.analyticsDefaultOpen}
            onChange={(event) => onChange({ analyticsDefaultOpen: event.target.checked })}
          />
        </label>

        <label className="settings-field settings-toggle">
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) => onChange({ reducedMotion: event.target.checked })}
          />
        </label>

        <label className="settings-field settings-range">
          <span>Animation intensity <b>{settings.animationIntensity.toFixed(2)}×</b></span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={settings.animationIntensity}
            onChange={(event) => onChange({ animationIntensity: Number(event.target.value) })}
          />
        </label>

        <label className="settings-field settings-range">
          <span>Panel opacity <b>{Math.round(settings.panelOpacity * 100)}%</b></span>
          <input
            type="range"
            min="0.35"
            max="0.96"
            step="0.01"
            value={settings.panelOpacity}
            onChange={(event) => onChange({ panelOpacity: Number(event.target.value) })}
          />
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <span>RENDERER</span>
          <small>Quality and information density</small>
        </div>

        <label className="settings-field">
          <span>Quality profile</span>
          <select
            value={settings.renderQuality}
            onChange={(event) => onChange({ renderQuality: event.target.value as RenderQuality })}
          >
            {qualities.map((quality) => <option key={quality}>{quality}</option>)}
          </select>
        </label>

        <label className="settings-field">
          <span>Target FPS</span>
          <select
            value={settings.targetFps}
            onChange={(event) => onChange({ targetFps: Number(event.target.value) as 30 | 60 | 120 })}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
          </select>
        </label>

        <label className="settings-field settings-range">
          <span>Glow intensity <b>{settings.glowIntensity.toFixed(2)}×</b></span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={settings.glowIntensity}
            onChange={(event) => onChange({ glowIntensity: Number(event.target.value) })}
          />
        </label>

        <label className="settings-field settings-range">
          <span>Label density <b>{Math.round(settings.labelDensity * 100)}%</b></span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.labelDensity}
            onChange={(event) => onChange({ labelDensity: Number(event.target.value) })}
          />
        </label>

        <label className="settings-field settings-range">
          <span>Graph density <b>{settings.graphDensity.toFixed(2)}×</b></span>
          <input
            type="range"
            min="0.25"
            max="1.5"
            step="0.05"
            value={settings.graphDensity}
            onChange={(event) => onChange({ graphDensity: Number(event.target.value) })}
          />
        </label>
      </section>

      <footer className="settings-footer">
        <span>Profile v{settings.version} · changes persist locally</span>
        <button type="button" onClick={onReset}>RESET DEFAULTS</button>
      </footer>
    </aside>
  );
}
