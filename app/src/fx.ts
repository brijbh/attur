import { save } from './store';

// Lightweight canvas particle engine: blasts, sparkles, confetti, star bursts.
type Kind = 'shard' | 'spark' | 'confetti' | 'ring' | 'star';
interface P {
  kind: Kind; x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  rot: number; vr: number; g: number; drag: number;
}

const PALETTE = ['#ff4fa3', '#ffc93c', '#3ee0b5', '#4fc3ff', '#b57bff', '#ff7a45', '#ffffff'];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];

let canvas: HTMLCanvasElement;
let g: CanvasRenderingContext2D;
let ps: P[] = [];
let running = false;
let dpr = 1;

export function initFx() {
  canvas = document.createElement('canvas');
  canvas.id = 'fx';
  document.body.appendChild(canvas);
  g = canvas.getContext('2d')!;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  addEventListener('resize', resize);
  resize();
}

const amount = (n: number) => Math.max(1, Math.round(save.settings.reducedMotion ? n * 0.25 : n));

function add(p: Partial<P> & { x: number; y: number }) {
  ps.push({ kind: 'spark', vx: 0, vy: 0, life: 0, max: 60, size: 4, color: '#fff', rot: 0, vr: 0, g: 0, drag: 0.98, ...p });
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export function blast(x: number, y: number, colors = PALETTE) {
  add({ kind: 'ring', x, y, max: 28, size: 10, color: '#ffffff' });
  for (let i = 0; i < amount(26); i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(4, 11);
    add({ kind: 'shard', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: rnd(30, 50), size: rnd(4, 9), color: pick(colors), rot: rnd(0, 6), vr: rnd(-0.3, 0.3), g: 0.25, drag: 0.93 });
  }
  sparkle(x, y, 10, 60);
}

export function sparkle(x: number, y: number, n = 12, spread = 40) {
  for (let i = 0; i < amount(n); i++) {
    add({ kind: 'star', x: x + rnd(-spread, spread), y: y + rnd(-spread, spread), vx: rnd(-1, 1), vy: rnd(-2.2, -0.4), max: rnd(35, 65), size: rnd(5, 11), color: pick(['#fff6c2', '#ffffff', '#ffc93c', '#bff6ff']), rot: rnd(0, 6), vr: rnd(-0.1, 0.1), drag: 0.97 });
  }
}

export function starBurst(x: number, y: number) {
  for (let i = 0; i < amount(14); i++) {
    const a = (i / 14) * Math.PI * 2, s = rnd(5, 8);
    add({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: 45, size: rnd(8, 14), color: '#ffc93c', vr: 0.15, drag: 0.92 });
  }
}

export function confetti(n = 170) {
  const w = innerWidth, h = innerHeight;
  for (let i = 0; i < amount(n); i++) {
    const left = i % 2 === 0;
    add({
      kind: 'confetti', x: left ? -10 : w + 10, y: h * rnd(0.6, 0.95),
      vx: (left ? 1 : -1) * rnd(4, 13), vy: rnd(-22, -10),
      max: rnd(140, 220), size: rnd(7, 13), color: pick(PALETTE),
      rot: rnd(0, 6), vr: rnd(-0.3, 0.3), g: 0.32, drag: 0.985,
    });
  }
}

function drawStar(x: number, y: number, r: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.32;
    const a = (i / 8) * Math.PI * 2;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath(); g.fill(); g.restore();
}

function loop() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  ps = ps.filter((p) => p.life < p.max);
  for (const p of ps) {
    p.life++;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const t = p.life / p.max;
    g.globalAlpha = p.kind === 'confetti' ? Math.min(1, (1 - t) * 3) : 1 - t;
    g.fillStyle = p.color;
    switch (p.kind) {
      case 'ring':
        g.strokeStyle = p.color; g.lineWidth = 6 * (1 - t);
        g.beginPath(); g.arc(p.x, p.y, p.size + t * 90, 0, Math.PI * 2); g.stroke();
        break;
      case 'shard':
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath(); g.moveTo(0, -p.size); g.lineTo(p.size * 0.6, p.size); g.lineTo(-p.size * 0.6, p.size); g.fill();
        g.restore();
        break;
      case 'star':
        g.shadowColor = p.color; g.shadowBlur = 10;
        drawStar(p.x, p.y, p.size * (t < 0.2 ? t * 5 : 1), p.rot);
        g.shadowBlur = 0;
        break;
      case 'confetti': {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.scale(1, Math.abs(Math.cos(p.life * 0.15 + p.rot)));
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
        p.vx += Math.sin(p.life * 0.1) * 0.08;
        break;
      }
      default:
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  if (ps.length) requestAnimationFrame(loop);
  else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
}

/** Center point of an element in viewport coordinates */
export function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Floating "+100" style text */
export function floatText(x: number, y: number, text: string, cls = '') {
  const el = document.createElement('div');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** Big centered banner ("Sweet!", "Brilliant!") */
export function banner(text: string, cls = '') {
  const el = document.createElement('div');
  el.className = `banner ${cls}`;
  el.innerHTML = `<span>${text}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
