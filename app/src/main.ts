import './style.css';
import { CHALLENGES, OBJECTS, activeLevels } from './data';
import { applySettings, persist, save, totalStars, type Settings } from './store';
import { initFx, blast, centerOf, sparkle } from './fx';
import { sfx, speak, unlockAudio } from './audio';
import { playLevel } from './game';

const app = document.getElementById('app')!;

/* ---------------- Home ---------------- */

function home() {
  const floaters = OBJECTS.slice(0, 10)
    .map((o, i) => `<img class="floater" src="${o.img}" alt="" style="--i:${i};left:${(i * 37) % 90 + 2}%;animation-delay:${-i * 1.7}s">`)
    .join('');
  app.innerHTML = `<section class="screen home">
    <div class="floaters" aria-hidden="true">${floaters}</div>
    <div class="home-inner">
      <div class="logo-wrap pop-in">
        <h1 class="sr-only">Attur</h1>
        <img class="logo-img" src="/atturr-logo.png" alt="Attur" />
        <p class="tagline">Remember the Way</p>
      </div>
      <p class="home-blurb">Walk the stairs. Spot the objects.<br>Remember them in the classroom!</p>
      <button class="btn btn-primary btn-huge pulse" id="play-btn">▶ Play</button>
      <div class="home-row">
        <span class="chip">⭐ ${totalStars()} stars</span>
        <button class="btn btn-ghost" id="settings-btn">⚙️ Settings</button>
      </div>
    </div>
  </section>`;
  document.getElementById('play-btn')!.onclick = (e) => {
    unlockAudio();
    sfx.tap();
    const { x, y } = centerOf(e.currentTarget as Element);
    blast(x, y);
    setTimeout(map, 250);
  };
  document.getElementById('settings-btn')!.onclick = () => { unlockAudio(); sfx.tap(); openSettings(home); };
}

/* ---------------- Level map ---------------- */

function map() {
  const ch = CHALLENGES[0];
  const levels = activeLevels(ch);
  const unlockedUpTo = levels.findIndex((l) => !save.stars[`${ch.id}/${l.id}`]);
  const maxOpen = unlockedUpTo === -1 ? levels.length - 1 : unlockedUpTo;
  const offsets = [50, 72, 50, 28, 50, 72, 50];

  const nodes = levels
    .map((l, i) => {
      const stars = save.stars[`${ch.id}/${l.id}`] || 0;
      const locked = i > maxOpen;
      const current = i === maxOpen;
      return `<li class="node-row" style="--x:${offsets[i % offsets.length]}%">
        <button class="node ${locked ? 'locked' : ''} ${current ? 'current' : ''} ${stars ? 'cleared' : ''}" data-i="${i}" ${locked ? 'disabled' : ''} aria-label="Level ${i + 1}: ${l.name}${locked ? ', locked' : ''}">
          <span class="node-num">${locked ? '🔒' : i + 1}</span>
          <span class="node-stars">${[0, 1, 2].map((s) => `<i class="${s < stars ? 'on' : ''}">★</i>`).join('')}</span>
        </button>
        <span class="node-label">${l.name}</span>
      </li>`;
    })
    .reverse()
    .join('');

  const others = CHALLENGES.slice(1)
    .map((c) => `<li class="soon-card"><span class="soon-emoji">${c.emoji}</span><div><b>${c.name}</b><small>${c.skill}</small></div><span class="soon-tag">Soon</span></li>`)
    .join('');

  app.innerHTML = `<section class="screen map">
    <header class="hud">
      <button class="icon-btn" id="home-btn" aria-label="Home">⌂</button>
      <div class="hud-mid"><div class="hud-level">${ch.emoji} ${ch.name}</div><div class="hud-sub">${ch.skill}</div></div>
      <button class="icon-btn" id="settings-btn" aria-label="Settings">⚙️</button>
    </header>
    <div class="map-scroll">
      <div class="map-goal">🏫 Classroom</div>
      <ol class="path">${nodes}</ol>
      <div class="map-start">🎒 Start</div>
      <h2 class="soon-title">More challenges</h2>
      <ul class="soon">${others}</ul>
    </div>
  </section>`;

  document.getElementById('home-btn')!.onclick = () => { sfx.tap(); home(); };
  document.getElementById('settings-btn')!.onclick = () => { sfx.tap(); openSettings(map); };
  document.querySelectorAll<HTMLButtonElement>('.node:not(.locked)').forEach((b) => {
    b.onclick = () => {
      sfx.tap();
      const { x, y } = centerOf(b);
      blast(x, y);
      setTimeout(() => playLevel(ch, levels, Number(b.dataset.i), map), 280);
    };
  });
  const cur = document.querySelector<HTMLElement>('.node.current');
  if (cur) {
    cur.scrollIntoView({ block: 'center' });
    setTimeout(() => { const { x, y } = centerOf(cur); sparkle(x, y, 14, 50); }, 300);
  }
}

/* ---------------- Settings ---------------- */

function openSettings(back: () => void) {
  const rows: [keyof Settings, string, string][] = [
    ['sound', '🔊 Sound effects', 'Pops, chimes and fanfares'],
    ['voice', '🗣️ Voice narration', 'Reads instructions and object names aloud'],
    ['largeText', '🔠 Large text', 'Bigger words and buttons'],
    ['highContrast', '🌗 High contrast', 'Stronger colours for easier reading'],
    ['reducedMotion', '🍃 Calm effects', 'Fewer particles and gentler motion'],
  ];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Settings');
  modal.innerHTML = `<div class="card pop-in">
    <h2>Settings</h2>
    <div class="settings">${rows
      .map(([k, label, hint]) => `<label class="toggle-row"><span><b>${label}</b><small>${hint}</small></span>
        <input type="checkbox" id="set-${k}" data-k="${k}" ${save.settings[k] ? 'checked' : ''}><i class="switch"></i></label>`)
      .join('')}</div>
    <button class="btn btn-primary btn-big" id="close-settings">Done</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll<HTMLInputElement>('input').forEach((inp) => {
    inp.onchange = () => {
      save.settings[inp.dataset.k as keyof Settings] = inp.checked;
      persist();
      applySettings();
      sfx.tap();
      if (inp.dataset.k === 'voice' && inp.checked) speak('Voice narration is on.');
    };
  });
  const close = () => { modal.remove(); back(); };
  document.getElementById('close-settings')!.onclick = () => { sfx.tap(); close(); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

/* ---------------- Boot ---------------- */

applySettings();
initFx();
// Warm image cache so objects pop instantly
OBJECTS.forEach((o) => (new Image().src = o.img));
['/bg/staircase.png', '/bg/classroom.png', '/atturr-logo.png', '/favicon.jpg'].forEach((s) => (new Image().src = s));
home();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js');
}
