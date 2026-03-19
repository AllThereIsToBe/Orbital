import type { AppearancePreferences } from "../../lib/useAppearancePreferences";
import { SectionHeader } from "../../components/SectionHeader";

interface SettingsCenterProps {
  preferences: AppearancePreferences;
  updatePreferences: (patch: Partial<AppearancePreferences>) => void;
  resetPreferences: () => void;
  embedded?: boolean;
}

export const SettingsCenter = ({
  preferences,
  updatePreferences,
  resetPreferences,
  embedded = false
}: SettingsCenterProps) => (
  <div className="view">
    {!embedded ? (
      <SectionHeader
        eyebrow="Settings"
        title="Tune the interface without editing code."
        description="Appearance settings are backed by CSS variables and local storage, so you can restyle the app live and keep your preferred layout."
        aside={
          <button className="secondary-button" onClick={resetPreferences} type="button">
            Reset theme
          </button>
        }
      />
    ) : (
      <div className="task-card-row settings-inline-header">
        <div>
          <p className="panel-label">Appearance</p>
          <h2>Live interface tuning</h2>
        </div>
        <button className="secondary-button" onClick={resetPreferences} type="button">
          Reset theme
        </button>
      </div>
    )}

    <section className="two-column-grid">
      <div className="card">
        <h2>Colors</h2>
        <div className="field-grid">
          <label className="field">
            <span>Accent</span>
            <input
              type="color"
              value={preferences.accent}
              onChange={(event) => updatePreferences({ accent: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Accent strong</span>
            <input
              type="color"
              value={preferences.accentStrong}
              onChange={(event) => updatePreferences({ accentStrong: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Background</span>
            <input
              type="color"
              value={preferences.background}
              onChange={(event) => updatePreferences({ background: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Background strong</span>
            <input
              type="color"
              value={preferences.backgroundStrong}
              onChange={(event) => updatePreferences({ backgroundStrong: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Layout</h2>
        <div className="field-grid single-column">
          <label className="field">
            <span>Sidebar width: {preferences.sidebarWidth}px</span>
            <input
              min={260}
              max={420}
              step={10}
              type="range"
              value={preferences.sidebarWidth}
              onChange={(event) => updatePreferences({ sidebarWidth: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Panel opacity: {preferences.panelOpacity.toFixed(2)}</span>
            <input
              min={0.55}
              max={0.95}
              step={0.01}
              type="range"
              value={preferences.panelOpacity}
              onChange={(event) => updatePreferences({ panelOpacity: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>
    </section>
  </div>
);
