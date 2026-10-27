// Data-driven content: challenges → levels → rounds.
// Add, edit, reorder or disable levels here without touching game logic.

export interface GameObject {
  id: string;
  name: string;
  img: string;
  lookAlikeGroup?: string;
}

export type RecallMode = 'pick' | 'place' | 'grid' | 'routine' | 'audio';

export interface RoomSpot {
  id: string;
  name: string;
  x: number; // percentage
  y: number; // percentage
}

export const ROOM_SPOTS: RoomSpot[] = [
  { id: 'shelf', name: 'Wall Shelf', x: 14, y: 32 },
  { id: 'desk', name: 'Study Desk', x: 22, y: 68 },
  { id: 'bookcase', name: 'Bookcase', x: 42, y: 46 },
  { id: 'window', name: 'Window Sill', x: 67, y: 42 },
  { id: 'table', name: 'Coffee Table', x: 58, y: 76 },
  { id: 'sofa', name: 'Armchair', x: 79, y: 68 },
  { id: 'drawer', name: 'Nightstand', x: 92, y: 74 },
];

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
  gridSize?: number;
  sequential?: boolean;
  strictOrder?: boolean;
  /** objects vanish two steps after appearing */
  vanish?: boolean;
  routineSubMode?: 'pair' | 'where' | 'missing' | 'changed' | 'detective';
  audioSubMode?: 'hear' | 'match' | 'order' | 'chain' | 'master';
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

const lookAlikes: Record<string, string> = {
  hat: 'headwear',
  cap: 'headwear',
  clock: 'timepiece',
  watch: 'timepiece',
  cup: 'drinkware',
  mug: 'drinkware',
  bell: 'soundmaker',
  guitar: 'soundmaker',
};

const names: Record<string, string> = {
  ball: 'Ball', hat: 'Hat', cap: 'Cap', bat: 'Bat', umbrella: 'Umbrella', book: 'Book',
  apple: 'Apple', clock: 'Clock', bell: 'Bell', key: 'Key', shoe: 'Shoe', cup: 'Cup',
  kite: 'Kite', teddy: 'Teddy Bear', lamp: 'Lamp', pencil: 'Pencil',
  watch: 'Watch', mug: 'Mug', glasses: 'Glasses', guitar: 'Guitar',
};

export const OBJECTS: GameObject[] = Object.entries(names).map(([id, name]) => ({
  id,
  name,
  img: `/objects/${id}.png`,
  lookAlikeGroup: lookAlikes[id],
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
  {
    id: 'assembly',
    name: 'The Assembly Line',
    skill: 'Sequential memory',
    emoji: '🏭',
    available: true,
    levels: [
      { id: 'first-in-line', name: 'First in Line', intro: 'Items are rolling on the conveyor belt. Watch the order carefully!', rounds: [3, 3, 4], stepMs: 1500, reviewMs: null, distractors: 2, mode: 'pick' },
      { id: 'keep-order', name: 'Keep the Order', intro: 'The factory is ramping up! Remember longer sequences in exact order.', rounds: [4, 4, 5], stepMs: 1300, reviewMs: null, distractors: 3, mode: 'pick' },
      { id: 'faster-line', name: 'Faster Line', intro: 'Speed boost! The belt moves fast. Stay sharp!', rounds: [4, 5, 5], stepMs: 850, reviewMs: 2500, distractors: 3, mode: 'pick' },
      { id: 'look-alike', name: 'Look Alike', intro: 'Look-alikes are on the line! Watch closely so you do not mix them up.', rounds: [4, 5, 6], stepMs: 1200, reviewMs: null, distractors: 3, mode: 'pick' },
      { id: 'reverse-gear', name: 'Reverse Gear', intro: 'Line reversed! Pack the items in REVERSE order (last item seen first)!', rounds: [4, 4, 5], stepMs: 1300, reviewMs: null, distractors: 2, mode: 'pick' },
      { id: 'master-sequence', name: 'Master Sequence', intro: 'Fast speed, long sequences, and tricky distractors. Become the Assembly Master!', rounds: [5, 6, 7], stepMs: 800, reviewMs: 2000, distractors: 4, mode: 'pick' },
    ],
  },
  {
    id: 'grid',
    name: 'The Grid',
    skill: 'Spatial memory',
    emoji: '🟪',
    available: true,
    levels: [
      { id: 'light-it-up', name: 'Light It Up', intro: 'Watch the tiles glow on the grid. Remember their positions!', rounds: [3, 3, 4], stepMs: 1600, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 3, sequential: false, strictOrder: false },
      { id: 'remember-spots', name: 'Remember the Spots', intro: 'A 4x4 grid! Keep your eyes on all the shining spots.', rounds: [4, 4, 5], stepMs: 1800, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 4, sequential: false, strictOrder: false },
      { id: 'bigger-picture', name: 'Bigger Picture', intro: 'Matrix expansion! 5x5 grid with larger constellations to recall.', rounds: [5, 6, 7], stepMs: 2200, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 5, sequential: false, strictOrder: false },
      { id: 'follow-lights', name: 'Follow the Lights', intro: 'Tiles flash one by one in a rhythm. Watch their trail!', rounds: [4, 4, 5], stepMs: 650, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 4, sequential: true, strictOrder: false },
      { id: 'in-order', name: 'In Order', intro: 'Precision test! Tap the flashing tiles back in the EXACT order they lit up!', rounds: [4, 5, 5], stepMs: 600, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 4, sequential: true, strictOrder: true },
      { id: 'grid-master', name: 'Grid Master', intro: '5x5 grid with fast sequential pulse. The ultimate test of spatial memory!', rounds: [5, 6, 7], stepMs: 550, reviewMs: null, distractors: 0, mode: 'grid', gridSize: 5, sequential: true, strictOrder: true },
    ],
  },
  {
    id: 'routine',
    name: 'The Daily Routine',
    skill: 'Contextual memory',
    emoji: '🏡',
    available: true,
    levels: [
      { id: 'perfect-pair', name: 'Perfect Pair', intro: 'Match items that naturally pair up in everyday life! Connect the pairs.', rounds: [3, 3, 4], stepMs: 1400, reviewMs: null, distractors: 2, mode: 'routine', routineSubMode: 'pair' },
      { id: 'where-was-it', name: 'Where Was It?', intro: 'Items are resting in the cozy room. Memorize where each item is placed!', rounds: [3, 4, 4], stepMs: 1600, reviewMs: null, distractors: 0, mode: 'routine', routineSubMode: 'where' },
      { id: 'whats-missing', name: 'What\'s Missing?', intro: 'Look around the room! When you check back, one item has vanished. Which one is gone?', rounds: [4, 4, 5], stepMs: 1800, reviewMs: null, distractors: 3, mode: 'routine', routineSubMode: 'missing' },
      { id: 'something-changed', name: 'Something Changed', intro: 'Something has moved or swapped spots in the room! Spot the anomaly.', rounds: [4, 4, 5], stepMs: 1600, reviewMs: null, distractors: 2, mode: 'routine', routineSubMode: 'changed' },
      { id: 'routine-detective', name: 'Routine Detective', intro: 'Multiple items have changed or vanished! Use your detective skills to find them all.', rounds: [4, 5, 6], stepMs: 1500, reviewMs: null, distractors: 3, mode: 'routine', routineSubMode: 'detective' },
    ],
  },
  {
    id: 'audio',
    name: 'The Audio-Visual Link',
    skill: 'Sound + visual',
    emoji: '🎧',
    available: true,
    levels: [
      { id: 'hear-and-find', name: 'Hear & Find', intro: 'Listen closely to the sound cue and pick the matching object!', rounds: [3, 3, 4], stepMs: 1500, reviewMs: null, distractors: 3, mode: 'audio', audioSubMode: 'hear' },
      { id: 'sound-match', name: 'Sound Match', intro: 'Sounds are playing from the speakers! Match each audio cue to its card.', rounds: [3, 4, 4], stepMs: 1400, reviewMs: null, distractors: 4, mode: 'audio', audioSubMode: 'match' },
      { id: 'listen-in-order', name: 'Listen in Order', intro: 'Hear a musical sequence of items. Tap them back in the exact order you heard!', rounds: [3, 3, 4], stepMs: 900, reviewMs: null, distractors: 2, mode: 'audio', audioSubMode: 'order' },
      { id: 'sound-chain', name: 'Sound Chain', intro: 'Longer sound sequences are playing in the studio! Keep up with the rhythmic chain.', rounds: [4, 4, 5], stepMs: 800, reviewMs: null, distractors: 3, mode: 'audio', audioSubMode: 'chain' },
      { id: 'sound-master', name: 'Sound Master', intro: 'Fast tempo, long audio chains, and tricky distractors. Become the Golden Ear Master!', rounds: [4, 5, 6], stepMs: 700, reviewMs: null, distractors: 4, mode: 'audio', audioSubMode: 'master' },
    ],
  },
];

export const activeLevels = (c: ChallengeDef) => c.levels.filter((l) => l.enabled !== false);
