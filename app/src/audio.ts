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
    // Pentatonic scale based notes for pleasant melodic patterns
    const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    const f = pentatonic[i % pentatonic.length] * (i >= pentatonic.length ? 1.5 : 1);
    tone(f, 0.24, 'sine', 0.18);
    tone(f * 2, 0.16, 'triangle', 0.08, 0.02);
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

export function speak(text: string) {
  if (!save.settings.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = save.settings.largeText ? 0.85 : 0.95;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}

export function unlockAudio() {
  ac().resume();
}
