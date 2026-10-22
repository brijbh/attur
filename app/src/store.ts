export interface Settings {
  sound: boolean;
  voice: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

interface SaveData {
  settings: Settings;
  stars: Record<string, number>;
  best: Record<string, number>;
}

const KEY = 'attur-save-v1';

const defaults: SaveData = {
  settings: {
    sound: true,
    voice: true,
    largeText: false,
    highContrast: false,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  stars: {},
  best: {},
};

function load(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) return { ...defaults, ...raw, settings: { ...defaults.settings, ...raw.settings } };
  } catch { /* ignore corrupt save */ }
  return structuredClone(defaults);
}

export const save: SaveData = load();

export function persist() {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function applySettings() {
  const r = document.documentElement.classList;
  r.toggle('large', save.settings.largeText);
  r.toggle('hc', save.settings.highContrast);
  r.toggle('calm', save.settings.reducedMotion);
}

export function recordResult(levelKey: string, stars: number, score: number) {
  save.stars[levelKey] = Math.max(save.stars[levelKey] || 0, stars);
  save.best[levelKey] = Math.max(save.best[levelKey] || 0, score);
  persist();
}

export const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
