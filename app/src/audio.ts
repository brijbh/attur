import { save } from './store';

// Synthesized SFX (no audio files) + speech narration.
let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, delay = 0, slideTo?: number) {
  if (!save.settings.sound) return;
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];

export const sfx = {
  tap: () => tone(660, 0.08, 'triangle', 0.12),
  pop: (i = 0) => { tone(scale[i % scale.length], 0.18, 'triangle', 0.16); tone(scale[i % scale.length] * 2, 0.12, 'sine', 0.06, 0.03); },
  step: (i = 0) => {
    const f = 200 + Math.min(i, 8) * 32;
    tone(f, 0.07, 'triangle', 0.11);
    tone(f * 1.5, 0.04, 'sine', 0.05, 0.02);
  },
  door: () => {
    tone(523.25, 0.18, 'sine', 0.14, 0);
    tone(659.25, 0.22, 'sine', 0.15, 0.08);
    tone(783.99, 0.35, 'triangle', 0.18, 0.16);
  },
  pickup: () => tone(520, 0.06, 'sine', 0.09),
  snap: () => { tone(380, 0.06, 'triangle', 0.1); tone(760, 0.08, 'sine', 0.08, 0.03); },
  scan: () => {
    tone(880, 0.08, 'sine', 0.14);
    tone(1320, 0.12, 'triangle', 0.1, 0.04);
  },
  gear: () => {
    tone(140, 0.08, 'sawtooth', 0.06);
    tone(175, 0.08, 'square', 0.05, 0.04);
  },
  gridTile: (i = 0) => {
    const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    const f = pentatonic[i % pentatonic.length] * (i >= pentatonic.length ? 1.5 : 1);
    tone(f, 0.24, 'sine', 0.18);
    tone(f * 2, 0.16, 'triangle', 0.08, 0.02);
  },
  spotReveal: () => {
    tone(440, 0.12, 'sine', 0.12);
    tone(659.25, 0.18, 'triangle', 0.1, 0.05);
    tone(880, 0.25, 'sine', 0.08, 0.1);
  },
  mystery: () => {
    tone(329.63, 0.2, 'triangle', 0.14);
    tone(392.00, 0.22, 'sine', 0.12, 0.08);
    tone(493.88, 0.3, 'sine', 0.15, 0.16);
  },
  audioPulse: () => {
    tone(523.25, 0.2, 'sine', 0.16);
    tone(1046.5, 0.15, 'triangle', 0.08, 0.04);
  },
  objectSound: (id: string) => {
    if (!save.settings.sound) return;
    switch (id) {
      case 'bell':
        tone(880, 0.45, 'sine', 0.22);
        tone(1760, 0.35, 'sine', 0.12, 0.02);
        tone(2640, 0.25, 'triangle', 0.08, 0.04);
        break;
      case 'clock':
      case 'watch':
        tone(1100, 0.03, 'triangle', 0.18);
        tone(820, 0.03, 'triangle', 0.14, 0.12);
        break;
      case 'guitar':
        // Warm plucked chord
        tone(164.81, 0.45, 'triangle', 0.18);
        tone(220.00, 0.42, 'triangle', 0.16, 0.025);
        tone(277.18, 0.40, 'sine', 0.14, 0.05);
        tone(329.63, 0.50, 'sine', 0.16, 0.075);
        break;
      case 'ball':
        // Cartoon rubber boing
        tone(180, 0.28, 'sine', 0.22, 0, 520);
        tone(480, 0.2, 'triangle', 0.12, 0.15, 260);
        break;
      case 'cup':
      case 'mug':
        // Porcelain ping
        tone(1975.53, 0.25, 'sine', 0.18);
        tone(3951.07, 0.15, 'sine', 0.08, 0.02);
        break;
      case 'lamp':
        // Switch click + warm hum
        tone(480, 0.05, 'square', 0.08);
        tone(130.81, 0.35, 'sine', 0.18, 0.04);
        break;
      case 'key':
        // Metallic jingle
        tone(1760, 0.12, 'triangle', 0.12);
        tone(2217.46, 0.15, 'sine', 0.14, 0.03);
        tone(2793.83, 0.18, 'sine', 0.10, 0.06);
        break;
      case 'book':
        // Paper page flutter
        tone(320, 0.12, 'sawtooth', 0.06, 0, 800);
        tone(450, 0.15, 'triangle', 0.08, 0.04, 200);
        break;
      case 'umbrella':
        // Raindrop sequence
        tone(1046.5, 0.06, 'sine', 0.12);
        tone(1318.5, 0.06, 'sine', 0.10, 0.08);
        tone(1174.6, 0.07, 'sine', 0.12, 0.15);
        break;
      case 'apple':
        // Crisp crunchy bite
        tone(480, 0.08, 'triangle', 0.16, 0, 180);
        tone(260, 0.09, 'sawtooth', 0.08, 0.03);
        break;
      case 'hat':
      case 'cap':
        // Soft hat swoosh
        tone(350, 0.14, 'triangle', 0.14, 0, 550);
        break;
      default: {
        // Melodic signature for other items
        const charCode = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
        const f = scale[charCode % scale.length];
        tone(f, 0.28, 'sine', 0.18);
        tone(f * 1.5, 0.22, 'triangle', 0.12, 0.04);
        break;
      }
    }
  },
  correct: (combo: number) => {
    const base = scale[Math.min(combo, scale.length - 1)];
    tone(base, 0.15, 'triangle', 0.2);
    tone(base * 1.5, 0.2, 'sine', 0.12, 0.06);
    tone(base * 2, 0.25, 'sine', 0.08, 0.12);
  },
  partial: () => { tone(440, 0.12, 'triangle', 0.14); tone(554, 0.16, 'triangle', 0.1, 0.07); },
  wrong: () => { tone(200, 0.22, 'sine', 0.16, 0, 140); },
  whoosh: () => tone(300, 0.35, 'sawtooth', 0.04, 0, 1200),
  combo: () => [0, 1, 2, 3].forEach((i) => tone(scale[i * 2], 0.14, 'square', 0.07, i * 0.07)),
  win: () => {
    [0, 2, 4, 5].forEach((n, i) => tone(scale[n], 0.25, 'triangle', 0.18, i * 0.13));
    tone(scale[7], 0.7, 'sine', 0.16, 0.55);
    tone(scale[5], 0.7, 'sine', 0.12, 0.55);
  },
  star: (i: number) => tone(scale[3 + i * 2], 0.3, 'sine', 0.2),
};

/* ---------------- Ambient Generative BGM ---------------- */

let bgmInterval: number | null = null;
let bgmGain: GainNode | null = null;
let bgmFilter: BiquadFilterNode | null = null;

// Peaceful, uplifting pentatonic chord loops
const CHORD_PROGRESSIONS = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 392.00], // G6
];

let chordIdx = 0;
let noteIdx = 0;

export const bgm = {
  start: () => {
    if (bgmInterval !== null || !save.settings.music) return;
    try {
      const a = ac();
      if (a.state === 'suspended') return;
      if (!bgmGain) {
        bgmGain = a.createGain();
        bgmGain.gain.setValueAtTime(0.04, a.currentTime);
        bgmFilter = a.createBiquadFilter();
        bgmFilter.type = 'lowpass';
        bgmFilter.frequency.setValueAtTime(950, a.currentTime);
        bgmFilter.connect(bgmGain);
        bgmGain.connect(a.destination);
      }

      bgmInterval = window.setInterval(() => {
        if (!save.settings.music || !bgmFilter) return;
        const a = ac();
        const currentChord = CHORD_PROGRESSIONS[chordIdx];
        const freq = currentChord[noteIdx % currentChord.length];

        // Soft, gentle bell-like arpeggiation note
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = noteIdx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, a.currentTime);

        g.gain.setValueAtTime(0.0001, a.currentTime);
        g.gain.linearRampToValueAtTime(0.035, a.currentTime + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.4);

        osc.connect(g);
        g.connect(bgmFilter);
        osc.start(a.currentTime);
        osc.stop(a.currentTime + 1.5);

        noteIdx++;
        if (noteIdx % 4 === 0) {
          chordIdx = (chordIdx + 1) % CHORD_PROGRESSIONS.length;
        }
      }, 750);
    } catch {
      // Audio context might not be allowed yet
    }
  },
  stop: () => {
    if (bgmInterval !== null) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  },
  update: () => {
    if (save.settings.music) {
      bgm.start();
    } else {
      bgm.stop();
    }
  },
};

export function speak(text: string) {
  if (!save.settings.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = save.settings.largeText ? 0.85 : 0.95;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}

export function unlockAudio() {
  ac().resume().then(() => {
    if (save.settings.music) bgm.start();
  });
}
