import { useEffect, useState } from "react";

export interface AppearancePreferences {
  accent: string;
  accentStrong: string;
  background: string;
  backgroundStrong: string;
  panelOpacity: number;
  sidebarWidth: number;
}

const STORAGE_KEY = "orbital-appearance-v1";

const DEFAULTS: AppearancePreferences = {
  accent: "#d85586",
  accentStrong: "#8e306c",
  background: "#f7eff3",
  backgroundStrong: "#f3e4ec",
  panelOpacity: 0.74,
  sidebarWidth: 320
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const loadPreferences = (): AppearancePreferences => {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULTS;
  }

  try {
    return {
      ...DEFAULTS,
      ...(JSON.parse(raw) as Partial<AppearancePreferences>)
    };
  } catch {
    return DEFAULTS;
  }
};

const applyPreferences = (preferences: AppearancePreferences) => {
  const root = document.documentElement;
  root.style.setProperty("--accent", preferences.accent);
  root.style.setProperty("--accent-strong", preferences.accentStrong);
  root.style.setProperty("--accent-soft", hexToRgba(preferences.accent, 0.15));
  root.style.setProperty("--bg", preferences.background);
  root.style.setProperty("--bg-strong", preferences.backgroundStrong);
  root.style.setProperty("--panel", `rgba(255, 255, 255, ${preferences.panelOpacity})`);
  root.style.setProperty(
    "--panel-strong",
    `rgba(255, 255, 255, ${Math.min(0.98, preferences.panelOpacity + 0.16)})`
  );
  root.style.setProperty("--sidebar-width", `${preferences.sidebarWidth}px`);
};

export const useAppearancePreferences = () => {
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => loadPreferences());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    applyPreferences(preferences);
  }, [preferences]);

  return {
    preferences,
    updatePreferences(patch: Partial<AppearancePreferences>) {
      setPreferences((current) => ({ ...current, ...patch }));
    },
    resetPreferences() {
      setPreferences(DEFAULTS);
    }
  };
};
