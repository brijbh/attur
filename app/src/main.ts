import './style.css';
import { CHALLENGES, OBJECTS, activeLevels } from './data';
import { applySettings, persist, save, totalStars, AVATARS, TROPHIES_LIST, type Settings } from './store';
import { initFx, blast, centerOf, sparkle } from './fx';
import { sfx, speak, unlockAudio, bgm } from './audio';
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
      <p class="home-blurb">Memory games with juice.<br>Train recall, order, and spatial skills!</p>
      <button class="btn btn-primary btn-huge pulse" id="play-btn">▶ Play</button>
      <div class="home-row" style="flex-wrap:wrap; justify-content:center;">
        <button class="chip btn-pill" id="profile-btn" aria-label="Player profile">${save.profile.avatar} ${save.profile.name}</button>
        <button class="chip btn-pill" id="trophy-btn" aria-label="Trophies">🏆 Trophies (${Object.keys(save.trophies).length}/${TROPHIES_LIST.length})</button>
        <button class="chip btn-pill" id="stars-chip">⭐ ${totalStars()} stars</button>
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
  document.getElementById('profile-btn')!.onclick = () => { unlockAudio(); sfx.tap(); openProfile(home); };
  document.getElementById('trophy-btn')!.onclick = () => { unlockAudio(); sfx.tap(); openTrophies(home); };
  document.getElementById('settings-btn')!.onclick = () => { unlockAudio(); sfx.tap(); openSettings(home); };
}

/* ---------------- Level map ---------------- */

let currentChallengeId = 'staircase';

function map(chId = currentChallengeId) {
  currentChallengeId = chId;
  const ch = CHALLENGES.find((c) => c.id === currentChallengeId) || CHALLENGES[0];
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

  const others = CHALLENGES.filter((c) => c.id !== ch.id)
    .map((c) => `
      <li class="soon-card ${c.available ? 'available' : ''}" data-ch="${c.id}" ${c.available ? 'style="cursor:pointer;"' : ''}>
        <span class="soon-emoji">${c.emoji}</span>
        <div><b>${c.name}</b><small>${c.skill}</small></div>
        <span class="soon-tag ${c.available ? 'ready' : ''}">${c.available ? 'Play ▶' : 'Soon'}</span>
      </li>
    `)
    .join('');

  const goalName =
    ch.id === 'assembly' ? '📦 Master Packer' :
    ch.id === 'grid' ? '🔮 Grid Master' :
    ch.id === 'routine' ? '🔍 Room Detective' :
    ch.id === 'audio' ? '🎼 Golden Ear' : '🏫 Classroom';
  const startName =
    ch.id === 'assembly' ? '⚙️ Infeed Bay' :
    ch.id === 'grid' ? '⚡ Matrix Core' :
    ch.id === 'routine' ? '🚪 Front Door' :
    ch.id === 'audio' ? '🎙️ Green Room' : '🎒 Start';

  app.innerHTML = `<section class="screen map">
    <header class="hud">
      <button class="icon-btn" id="home-btn" aria-label="Home">⌂</button>
      <div class="hud-mid"><div class="hud-level">${ch.emoji} ${ch.name}</div><div class="hud-sub">${ch.skill}</div></div>
      <button class="icon-btn" id="trophy-hud-btn" aria-label="Trophies">🏆</button>
      <button class="icon-btn" id="settings-btn" aria-label="Settings">⚙️</button>
    </header>
    <div class="map-scroll">
      <nav class="challenge-tabs" aria-label="Select Challenge">
        ${CHALLENGES.filter((c) => c.available).map((c) => `
          <button class="challenge-tab ${c.id === ch.id ? 'active' : ''}" data-ch="${c.id}">
            <span>${c.emoji}</span> <b>${c.name}</b>
          </button>
        `).join('')}
      </nav>
      <div class="map-goal">${goalName}</div>
      <ol class="path">${nodes}</ol>
      <div class="map-start">${startName}</div>
      <h2 class="soon-title">More challenges</h2>
      <ul class="soon">${others}</ul>
    </div>
  </section>`;

  document.getElementById('home-btn')!.onclick = () => { sfx.tap(); home(); };
  document.getElementById('trophy-hud-btn')!.onclick = () => { sfx.tap(); openTrophies(() => map(ch.id)); };
  document.getElementById('settings-btn')!.onclick = () => { sfx.tap(); openSettings(() => map(ch.id)); };

  document.querySelectorAll<HTMLButtonElement>('.challenge-tab').forEach((tab) => {
    tab.onclick = () => {
      sfx.tap();
      map(tab.dataset.ch!);
    };
  });

  document.querySelectorAll<HTMLElement>('.soon-card.available').forEach((card) => {
    card.onclick = () => {
      sfx.tap();
      map(card.dataset.ch!);
    };
  });

  document.querySelectorAll<HTMLButtonElement>('.node:not(.locked)').forEach((b) => {
    b.onclick = () => {
      sfx.tap();
      const { x, y } = centerOf(b);
      blast(x, y);
      setTimeout(() => playLevel(ch, levels, Number(b.dataset.i), () => map(ch.id)), 280);
    };
  });

  const cur = document.querySelector<HTMLElement>('.node.current');
  if (cur) {
    cur.scrollIntoView({ block: 'center' });
    setTimeout(() => { const { x, y } = centerOf(cur); sparkle(x, y, 14, 50); }, 300);
  }
}

/* ---------------- Trophies & Stats ---------------- */

function openTrophies(back: () => void) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Trophy Cabinet & Stats');

  const trophyCards = TROPHIES_LIST.map((t) => {
    const isUnlocked = !!save.trophies[t.id];
    return `<div class="trophy-card ${isUnlocked ? 'unlocked' : 'locked'}">
      <span class="t-emoji">${isUnlocked ? t.emoji : '🔒'}</span>
      <b>${t.name}</b>
      <small>${t.desc}</small>
    </div>`;
  }).join('');

  modal.innerHTML = `<div class="card pop-in" style="max-width:480px;">
    <h2>🏆 Trophy Cabinet</h2>
    <div class="stats-summary">
      <div class="stat-box"><small>Stars</small><b>⭐ ${totalStars()}</b></div>
      <div class="stat-box"><small>Games</small><b>🎮 ${save.stats.gamesPlayed}</b></div>
      <div class="stat-box"><small>Streak</small><b>⚡ ${save.stats.highestCombo}x</b></div>
      <div class="stat-box"><small>Score</small><b>🎯 ${save.stats.totalScore}</b></div>
    </div>
    <div class="trophy-grid">${trophyCards}</div>
    <button class="btn btn-primary btn-big" id="close-trophies" style="margin-top:0.8rem;">Done</button>
  </div>`;

  document.body.appendChild(modal);
  const close = () => { modal.remove(); back(); };
  document.getElementById('close-trophies')!.onclick = () => { sfx.tap(); close(); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

/* ---------------- Player Profile ---------------- */

function openProfile(back: () => void) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Player Profile');

  let selectedAvatar = save.profile.avatar;

  const avatarButtons = AVATARS.map(
    (a) => `<button class="avatar-opt ${a === selectedAvatar ? 'selected' : ''}" data-av="${a}">${a}</button>`
  ).join('');

  modal.innerHTML = `<div class="card pop-in" style="max-width:380px;">
    <h2>Player Profile</h2>
    <p style="margin:0.2rem 0; color:var(--muted); font-size:0.95rem;">Choose your memory avatar & name</p>
    <div class="avatar-row">${avatarButtons}</div>
    <input type="text" id="player-name-inp" class="profile-input" value="${save.profile.name}" maxlength="16" placeholder="Your Name" />
    <div style="display:flex; gap:0.5rem; width:100%; margin-top:0.9rem;">
      <button class="btn btn-primary btn-big" id="save-profile" style="flex:1;">Save</button>
      <button class="btn btn-ghost" id="cancel-profile">Cancel</button>
    </div>
  </div>`;

  document.body.appendChild(modal);

  modal.querySelectorAll<HTMLButtonElement>('.avatar-opt').forEach((btn) => {
    btn.onclick = () => {
      sfx.tap();
      selectedAvatar = btn.dataset.av!;
      modal.querySelectorAll('.avatar-opt').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });

  const close = () => { modal.remove(); back(); };

  document.getElementById('save-profile')!.onclick = () => {
    const inp = document.getElementById('player-name-inp') as HTMLInputElement;
    const name = inp.value.trim() || 'Player 1';
    save.profile.name = name;
    save.profile.avatar = selectedAvatar;
    persist();
    sfx.tap();
    speak(`Profile saved, ${name}!`);
    close();
  };
  document.getElementById('cancel-profile')!.onclick = () => { sfx.tap(); close(); };
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

/* ---------------- Settings ---------------- */

function openSettings(back: () => void) {
  const rows: [keyof Settings, string, string][] = [
    ['sound', '🔊 Sound effects', 'Pops, chimes and fanfares'],
    ['music', '🎵 Ambient music', 'Gentle relaxing background synth tones'],
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
      if (inp.dataset.k === 'music') bgm.update();
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
['/bg/staircase.png', '/bg/classroom.png', '/bg/assembly.png', '/bg/grid.png', '/bg/routine.png', '/bg/audio.png', '/atturr-logo.png', '/favicon.jpg'].forEach((s) => (new Image().src = s));
home();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js');
}
