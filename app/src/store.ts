export interface Settings {
  sound: boolean;
  music: boolean;
  voice: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface PlayerProfile {
  name: string;
  avatar: string;
}

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
}

export const TROPHIES_LIST: TrophyDef[] = [
  { id: 'first_step', name: 'First Step', desc: 'Clear your first Staircase level', emoji: '🪜' },
  { id: 'staircase_grad', name: 'Top of the Stairs', desc: 'Conquer all 5 Staircase levels', emoji: '🎓' },
  { id: 'factory_worker', name: 'Assembly Cadet', desc: 'Pack your first crate in the Assembly Line', emoji: '📦' },
  { id: 'reverse_master', name: 'Time Bender', desc: 'Clear the Reverse Gear challenge', emoji: '🔄' },
  { id: 'grid_scout', name: 'Matrix Scout', desc: 'Solve your first Grid pattern', emoji: '🟪' },
  { id: 'grid_master', name: 'Grid Master', desc: 'Conquer Level 6 of The Grid', emoji: '🔮' },
  { id: 'routine_detective', name: 'Room Detective', desc: 'Conquer all 5 Daily Routine levels', emoji: '🏡' },
  { id: 'sound_master', name: 'Golden Ear', desc: 'Conquer all 5 Audio-Visual Link levels', emoji: '🎧' },
  { id: 'all_rounder', name: 'Grand Slam', desc: 'Score stars across all 5 game challenges', emoji: '🌟' },
  { id: 'combo_king', name: 'Sharp Mind', desc: 'Achieve a 5x combo streak', emoji: '⚡' },
  { id: 'star_collector', name: 'Star Catcher', desc: 'Earn 15 total stars', emoji: '⭐' },
  { id: 'grandmaster', name: 'Memory Grandmaster', desc: 'Earn 30 total stars', emoji: '👑' },
];

export const AVATARS = ['🧒', '👧', '🦊', '🦉', '🚀', '🐱', '⚡', '🌟'];

interface SaveData {
  settings: Settings;
  profile: PlayerProfile;
  stars: Record<string, number>;
  best: Record<string, number>;
  trophies: Record<string, number>; // trophyId -> timestamp
  stats: {
    gamesPlayed: number;
    highestCombo: number;
    totalScore: number;
  };
}

const KEY = 'attur-save-v1';

const defaults: SaveData = {
  settings: {
    sound: true,
    music: true,
    voice: true,
    largeText: false,
    highContrast: false,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  profile: {
    name: 'Player 1',
    avatar: '🧒',
  },
  stars: {},
  best: {},
  trophies: {},
  stats: {
    gamesPlayed: 0,
    highestCombo: 0,
    totalScore: 0,
  },
};

function load(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) {
      return {
        ...defaults,
        ...raw,
        settings: { ...defaults.settings, ...raw.settings },
        profile: { ...defaults.profile, ...raw.profile },
        stats: { ...defaults.stats, ...raw.stats },
        trophies: { ...defaults.trophies, ...raw.trophies },
      };
    }
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

export function checkTrophies(lastCombo = 0): TrophyDef[] {
  const newlyUnlocked: TrophyDef[] = [];
  const starsTotal = totalStars();
  const unlocked = save.trophies;

  const tryUnlock = (id: string, condition: boolean) => {
    if (condition && !unlocked[id]) {
      unlocked[id] = Date.now();
      const def = TROPHIES_LIST.find((t) => t.id === id);
      if (def) newlyUnlocked.push(def);
    }
  };

  // Check conditions
  tryUnlock('first_step', !!save.stars['staircase/first-step']);
  tryUnlock('staircase_grad', ['first-step', 'look-again', 'climbing-higher', 'right-step', 'staircase-master'].every((id) => (save.stars[`staircase/${id}`] || 0) > 0));
  tryUnlock('factory_worker', Object.keys(save.stars).some((k) => k.startsWith('assembly/') && save.stars[k] > 0));
  tryUnlock('reverse_master', (save.stars['assembly/reverse-gear'] || 0) > 0);
  tryUnlock('grid_scout', Object.keys(save.stars).some((k) => k.startsWith('grid/') && save.stars[k] > 0));
  tryUnlock('grid_master', (save.stars['grid/grid-master'] || 0) > 0);
  tryUnlock('routine_detective', ['perfect-pair', 'where-was-it', 'whats-missing', 'something-changed', 'routine-detective'].every((id) => (save.stars[`routine/${id}`] || 0) > 0));
  tryUnlock('sound_master', ['hear-and-find', 'sound-match', 'listen-in-order', 'sound-chain', 'sound-master'].every((id) => (save.stars[`audio/${id}`] || 0) > 0));
  
  const chs = ['staircase', 'assembly', 'grid', 'routine', 'audio'];
  const hasAll = chs.every((c) => Object.keys(save.stars).some((k) => k.startsWith(`${c}/`) && save.stars[k] > 0));
  tryUnlock('all_rounder', hasAll);

  tryUnlock('combo_king', lastCombo >= 5 || save.stats.highestCombo >= 5);
  tryUnlock('star_collector', starsTotal >= 15);
  tryUnlock('grandmaster', starsTotal >= 30);

  if (newlyUnlocked.length > 0) persist();
  return newlyUnlocked;
}

export function recordResult(levelKey: string, stars: number, score: number, maxCombo = 0) {
  save.stars[levelKey] = Math.max(save.stars[levelKey] || 0, stars);
  save.best[levelKey] = Math.max(save.best[levelKey] || 0, score);
  save.stats.gamesPlayed++;
  save.stats.totalScore += score;
  save.stats.highestCombo = Math.max(save.stats.highestCombo, maxCombo);
  persist();
  return checkTrophies(maxCombo);
}

export const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
