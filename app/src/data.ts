// Data-driven content: challenges → levels → rounds.
// Add, edit, reorder or disable levels here without touching game logic.

export interface GameObject {
  id: string;
  name: string;
  img: string;
}

export type RecallMode = 'pick' | 'place';

export interface LevelDef {
  id: string;
  name: string;
  intro: string;
  /** object count for each round (2–4 rounds) */
  rounds: number[];
  /** ms the walker pauses on each step */
  stepMs: number;
  /** null = untimed (player taps Ready), otherwise ms of extra review time */
  reviewMs: number | null;
  distractors: number;
  mode: RecallMode;
  /** objects vanish two steps after appearing */
  vanish?: boolean;
  enabled?: boolean;
}

export interface ChallengeDef {
  id: string;
  name: string;
  skill: string;
  emoji: string;
  available: boolean;
  levels: LevelDef[];
}

const names: Record<string, string> = {
  ball: 'Ball', hat: 'Hat', cap: 'Cap', bat: 'Bat', umbrella: 'Umbrella', book: 'Book',
  apple: 'Apple', clock: 'Clock', bell: 'Bell', key: 'Key', shoe: 'Shoe', cup: 'Cup',
  kite: 'Kite', teddy: 'Teddy Bear', lamp: 'Lamp', pencil: 'Pencil',
};

export const OBJECTS: GameObject[] = Object.entries(names).map(([id, name]) => ({
  id,
  name,
  img: `/objects/${id}.png`,
}));

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'staircase',
    name: 'The Virtual Staircase',
    skill: 'Object + location recall',
    emoji: '🪜',
    available: true,
    levels: [
      { id: 'first-step', name: 'First Step', intro: 'Walk up the stairs and look at each object. Take your time!', rounds: [3, 3, 4], stepMs: 1700, reviewMs: null, distractors: 2, mode: 'pick' },
      { id: 'look-again', name: 'Look Again', intro: 'This time the clock is ticking. Look quickly!', rounds: [4, 5, 5], stepMs: 1400, reviewMs: 3000, distractors: 3, mode: 'pick' },
      { id: 'climbing-higher', name: 'Climbing Higher', intro: 'More stairs, more objects. Watch out for tricky look-alikes!', rounds: [6, 7, 8], stepMs: 1200, reviewMs: 3000, distractors: 4, mode: 'pick' },
      { id: 'right-step', name: 'Right Step', intro: 'Remember exactly which step each object was on.', rounds: [4, 5, 6], stepMs: 1400, reviewMs: 3000, distractors: 0, mode: 'place' },
      { id: 'staircase-master', name: 'Staircase Master', intro: 'Objects disappear as you climb! Remember them fast.', rounds: [5, 6, 7, 8], stepMs: 1200, reviewMs: 2000, distractors: 4, mode: 'pick', vanish: true },
    ],
  },
  { id: 'assembly', name: 'The Assembly Line', skill: 'Sequential memory', emoji: '🏭', available: false, levels: [] },
  { id: 'grid', name: 'The Grid', skill: 'Spatial memory', emoji: '🟪', available: false, levels: [] },
  { id: 'routine', name: 'The Daily Routine', skill: 'Contextual memory', emoji: '🏡', available: false, levels: [] },
  { id: 'audio', name: 'The Audio-Visual Link', skill: 'Sound + visual', emoji: '🔔', available: false, levels: [] },
];

export const activeLevels = (c: ChallengeDef) => c.levels.filter((l) => l.enabled !== false);
