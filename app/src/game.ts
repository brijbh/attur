import { OBJECTS, ROOM_SPOTS, type ChallengeDef, type GameObject, type LevelDef } from './data';
import { sfx, speak } from './audio';
import { banner, blast, centerOf, confetti, floatText, sparkle, starBurst } from './fx';
import { recordResult, save } from './store';

const app = () => document.getElementById('app')!;

class Aborted extends Error {}
let session = 0;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function makeSleep(id: number) {
  return (ms: number) =>
    new Promise<void>((res, rej) =>
      setTimeout(() => (id === session ? res() : rej(new Aborted())), save.settings.reducedMotion ? ms * 0.9 : ms)
    );
}

// Follows the painted staircase in /bg/staircase.png (bottom-centre → upper-left),
// zigzagging left/right so neighbouring objects never overlap.
const padPos = (i: number, n: number) => {
  const t = n > 1 ? i / (n - 1) : 0.5;
  const side = n > 3 ? (i % 2 === 0 ? -1 : 1) * 11 : 0;
  return { x: 58 - 20 * t + side, y: 86 - 46 * t };
};
const DOOR = { x: 22, y: 24 };

interface RoundResult { accuracy: number; score: number }

interface Ctx {
  challenge: ChallengeDef;
  level: LevelDef;
  levelIndex: number;
  roundIndex: number;
  score: number;
  combo: number;
  sleep: (ms: number) => Promise<void>;
  onExit: () => void;
}

function hud(c: Ctx) {
  const dots = c.level.rounds
    .map((_, i) => `<span class="dot ${i < c.roundIndex ? 'done' : i === c.roundIndex ? 'now' : ''}"></span>`)
    .join('');
  return `<header class="hud">
    <button class="icon-btn" id="quit-btn" aria-label="Back to map">✕</button>
    <div class="hud-mid"><div class="hud-level">${c.level.name}</div><div class="dots" aria-label="Round ${c.roundIndex + 1} of ${c.level.rounds.length}">${dots}</div></div>
    <div class="hud-score" aria-live="polite"><span>⭐</span><b id="score">${c.score}</b></div>
  </header>`;
}

function bindQuit(c: Ctx) {
  document.getElementById('quit-btn')!.onclick = () => {
    session++;
    speechSynthesis?.cancel();
    sfx.tap();
    c.onExit();
  };
}

function addScore(c: Ctx, pts: number) {
  c.score += pts;
  const el = document.getElementById('score');
  if (el) {
    el.textContent = String(c.score);
    el.parentElement!.classList.remove('bump');
    void el.offsetWidth;
    el.parentElement!.classList.add('bump');
  }
}

function comboCheer(combo: number) {
  const cheers: Record<number, string> = { 3: 'Sweet!', 5: 'Brilliant!', 7: 'Amazing!', 9: 'Memory Master!' };
  if (cheers[combo]) {
    banner(cheers[combo], 'combo');
    sfx.combo();
    starBurst(innerWidth / 2, innerHeight / 2);
    speak(cheers[combo]);
  }
}

/* ---------------- Intro ---------------- */

async function intro(c: Ctx) {
  const modeDesc =
    c.challenge.id === 'audio'
      ? (c.level.audioSubMode === 'order' || c.level.audioSubMode === 'chain' || c.level.audioSubMode === 'master' ? '🎶 Remember sound order' : '🎧 Match sound to object')
      : c.challenge.id === 'routine'
      ? '🏡 Room observation'
      : c.challenge.id === 'grid'
      ? '🟪 Spatial matrix memory'
      : c.challenge.id === 'assembly'
      ? '🏭 Conveyor line recall'
      : c.level.mode === 'place'
      ? '🪜 Place on steps'
      : '🔢 Recall in order';

  app().innerHTML = `<section class="screen intro-screen">
    <div class="card pop-in">
      <div class="intro-badge">Level ${c.levelIndex + 1}</div>
      <h1>${c.level.name}</h1>
      <p>${c.level.intro}</p>
      <ul class="intro-facts">
        <li>🎯 ${c.level.rounds.length} rounds</li>
        <li>${c.level.reviewMs === null ? '🐢 No timer' : '⏱️ Timed'}</li>
        <li>${modeDesc}</li>
      </ul>
      <button class="btn btn-primary btn-big" id="start-btn">Let's Go!</button>
      <button class="btn btn-ghost" id="back-btn">Back to map</button>
    </div>
  </section>`;
  speak(`${c.level.name}. ${c.level.intro}`);
  await new Promise<void>((res) => {
    document.getElementById('start-btn')!.onclick = () => { sfx.tap(); res(); };
    document.getElementById('back-btn')!.onclick = () => { session++; sfx.tap(); c.onExit(); };
  });
}

/* ---------------- Memorize: walk the staircase ---------------- */

function stageHtml(n: number, numbered: boolean) {
  return Array.from({ length: n }, (_, i) => {
    const p = padPos(i, n);
    return `<div class="pad" data-i="${i}" style="left:${p.x}%;top:${p.y}%">${numbered ? `<span class="pad-num">${i + 1}</span>` : ''}</div>`;
  }).join('');
}

async function memorize(c: Ctx, items: GameObject[]) {
  const n = items.length;
  app().innerHTML = `<section class="screen play">
    ${hud(c)}
    <div class="stage" style="background-image:url(/bg/staircase.png)">
      ${stageHtml(n, true)}
      <div class="door" aria-hidden="true" style="left:${DOOR.x}%;top:${DOOR.y}%">🚪</div>
      <div class="walker" id="walker" aria-hidden="true">
        <img class="walker-sprite" src="/walker.png" alt="" />
        <div class="walker-shadow"></div>
      </div>
    </div>
    <p class="caption" id="caption" aria-live="polite">Round ${c.roundIndex + 1}: watch carefully…</p>
    <div class="actions" id="actions"></div>
  </section>`;
  bindQuit(c);
  const walker = document.getElementById('walker')!;
  const caption = document.getElementById('caption')!;
  const pads = [...document.querySelectorAll<HTMLElement>('.pad')];
  const moveWalker = (x: number, y: number) => {
    walker.style.left = `${x}%`;
    walker.style.top = `${y - 6}%`;
  };
  moveWalker(70, 99);
  await c.sleep(700);

  for (let i = 0; i < n; i++) {
    const p = padPos(i, n);
    moveWalker(p.x - 9, p.y - 5);
    walker.classList.remove('hop'); void walker.offsetWidth; walker.classList.add('hop');
    sfx.step(i);
    await c.sleep(450);
    const img = document.createElement('img');
    img.src = items[i].img;
    img.alt = items[i].name;
    img.className = 'obj pop-in';
    pads[i].appendChild(img);
    pads[i].classList.add('lit');
    const { x, y } = centerOf(pads[i]);
    sparkle(x, y - 20, 10, 30);
    sfx.pop(i);
    caption.innerHTML = `Step ${i + 1}: <b>${items[i].name}</b>`;
    speak(items[i].name);
    if (c.level.vanish && i >= 2) vanish(pads[i - 2]);
    await c.sleep(c.level.stepMs);
  }
  if (c.level.vanish) {
    for (let i = Math.max(0, n - 2); i < n; i++) vanish(pads[i]);
  }

  moveWalker(DOOR.x, DOOR.y + 6);
  walker.classList.add('cheer');
  sfx.door();

  const actions = document.getElementById('actions')!;
  if (c.level.reviewMs === null) {
    caption.textContent = 'Got them all? Head into the classroom when you are ready.';
    actions.innerHTML = `<button class="btn btn-primary btn-big pulse" id="ready-btn">I'm Ready 🚪</button>`;
    await new Promise<void>((res) => (document.getElementById('ready-btn')!.onclick = () => { sfx.tap(); res(); }));
  } else {
    const secs = Math.ceil(c.level.reviewMs / 1000);
    caption.textContent = c.level.vanish ? 'Into the classroom…' : 'Last look!';
    actions.innerHTML = `<div class="timer" style="--dur:${c.level.reviewMs}ms"><span id="tleft">${secs}</span></div>`;
    for (let s = secs; s > 0; s--) {
      document.getElementById('tleft')!.textContent = String(s);
      await c.sleep(1000);
    }
  }
}

function vanish(pad: HTMLElement) {
  const img = pad.querySelector('img');
  if (!img || img.classList.contains('poof')) return;
  img.classList.add('poof');
  const { x, y } = centerOf(pad);
  sparkle(x, y - 20, 6, 20);
}

/* ---------------- Recall: pick in order ---------------- */

async function recallPick(c: Ctx, items: GameObject[]): Promise<RoundResult> {
  const n = items.length;
  const pool = OBJECTS.filter((o) => !items.includes(o));

  // Prioritize tricky look-alikes of the items shown in this round
  const lookAlikeGroups = new Set(items.map((o) => o.lookAlikeGroup).filter(Boolean));
  const lookAlikePool = pool.filter((o) => o.lookAlikeGroup && lookAlikeGroups.has(o.lookAlikeGroup));
  const genericPool = pool.filter((o) => !lookAlikePool.includes(o));
  const chosenDistractors = [...shuffle(lookAlikePool), ...shuffle(genericPool)].slice(0, c.level.distractors);
  const tray = shuffle([...items, ...chosenDistractors]);
  const maxMiss = 3;

  app().innerHTML = `<section class="screen play classroom" style="background-image:url(/bg/classroom.png)">
    ${hud(c)}
    <h2 class="prompt">Which objects did you see?<small>Tap them in the order you passed them</small></h2>
    <div class="slots">${items.map((_, i) => `<div class="slot" data-i="${i}"><span>${i + 1}</span></div>`).join('')}</div>
    <div class="tray">${tray.map((o) => `<button class="tile" data-id="${o.id}" aria-label="${o.name}"><img src="${o.img}" alt=""><span>${o.name}</span></button>`).join('')}</div>
    <div class="misses" aria-label="Misses allowed">${Array.from({ length: maxMiss }, () => '<span class="heart">💖</span>').join('')}</div>
  </section>`;
  bindQuit(c);
  speak('Which objects did you see? Tap them in order.');

  const slots = [...document.querySelectorAll<HTMLElement>('.slot')];
  const hearts = [...document.querySelectorAll<HTMLElement>('.heart')];
  let filled = 0, inOrder = 0, outOrder = 0, misses = 0, roundScore = 0;

  await new Promise<void>((done) => {
    const finish = () => { document.querySelectorAll<HTMLButtonElement>('.tile').forEach((t) => (t.disabled = true)); done(); };
    document.querySelectorAll<HTMLButtonElement>('.tile').forEach((tile) => {
      tile.onclick = () => {
        if (tile.disabled) return;
        const obj = OBJECTS.find((o) => o.id === tile.dataset.id)!;
        const { x, y } = centerOf(tile);
        const expected = items[filled];
        const idx = items.indexOf(obj);
        if (obj === expected || idx >= 0) {
          const exact = obj === expected;
          tile.disabled = true;
          tile.classList.add('picked');
          const slot = slots[filled];
          slot.innerHTML = `<img src="${obj.img}" alt="${obj.name}" class="pop-in">`;
          slot.classList.add(exact ? 'good' : 'ok');
          let pts: number;
          if (exact) {
            c.combo++; inOrder++;
            pts = 100 + 25 * Math.min(c.combo - 1, 8);
            blast(x, y);
            sfx.correct(c.combo);
            floatText(x, y - 30, `+${pts}`);
            comboCheer(c.combo);
          } else {
            c.combo = 0; outOrder++;
            pts = 40;
            sparkle(x, y, 10);
            sfx.partial();
            floatText(x, y - 30, `+${pts} wrong order`, 'meh');
          }
          const s = centerOf(slot);
          sparkle(s.x, s.y, 6, 20);
          roundScore += pts;
          addScore(c, pts);
          filled++;
          if (filled === n) setTimeout(finish, 500);
        } else {
          c.combo = 0;
          misses++;
          tile.classList.remove('shake'); void tile.offsetWidth; tile.classList.add('shake');
          sfx.wrong();
          floatText(x, y - 30, 'Not this one', 'bad');
          hearts[maxMiss - misses]?.classList.add('lost');
          if (misses >= maxMiss) setTimeout(finish, 400);
        }
      };
    });
  });

  // Reveal any missed slots
  for (let i = filled; i < n; i++) {
    slots[i].innerHTML = `<img src="${items[i].img}" alt="${items[i].name}" class="ghost">`;
    slots[i].classList.add('missed');
  }
  await c.sleep(filled < n ? 1800 : 700);
  return { accuracy: (inOrder + 0.5 * outOrder) / n, score: roundScore };
}

/* ---------------- Recall: place on the right step ---------------- */

async function recallPlace(c: Ctx, items: GameObject[]): Promise<RoundResult> {
  const n = items.length;
  const maxMiss = 4;
  app().innerHTML = `<section class="screen play">
    ${hud(c)}
    <h2 class="prompt compact">Put each object back on its step<small>Drag to a step, or tap object then step</small></h2>
    <div class="stage short" style="background-image:url(/bg/staircase.png)">${stageHtml(n, true)}</div>
    <div class="tray small">${shuffle(items).map((o) => `<button class="tile" data-id="${o.id}" aria-label="${o.name}"><img src="${o.img}" alt=""><span>${o.name}</span></button>`).join('')}</div>
    <div class="misses">${Array.from({ length: maxMiss }, () => '<span class="heart">💖</span>').join('')}</div>
  </section>`;
  bindQuit(c);
  speak('Put each object back on its step.');

  const pads = [...document.querySelectorAll<HTMLElement>('.pad')];
  const hearts = [...document.querySelectorAll<HTMLElement>('.heart')];
  let selected: HTMLButtonElement | null = null;
  let placed = 0, misses = 0, roundScore = 0;

  await new Promise<void>((done) => {
    const finish = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      cleanDrag();
      done();
    };

    const tryPlace = (tile: HTMLButtonElement, padIndex: number) => {
      if (tile.disabled) return false;
      const pad = pads[padIndex];
      if (!pad || pad.classList.contains('filled')) return false;

      const obj = OBJECTS.find((o) => o.id === tile.dataset.id)!;
      const { x, y } = centerOf(pad);
      if (items[padIndex] === obj) {
        c.combo++;
        placed++;
        const pts = 100 + 25 * Math.min(c.combo - 1, 8);
        pad.innerHTML = `<span class="pad-num">${padIndex + 1}</span><img class="obj pop-in" src="${obj.img}" alt="${obj.name}">`;
        pad.classList.add('filled', 'lit');
        tile.disabled = true;
        tile.classList.remove('selected', 'dragging-source');
        tile.classList.add('picked');
        selected = null;
        pads.forEach((p) => p.classList.remove('target', 'drag-hover'));
        blast(x, y);
        sfx.correct(c.combo);
        floatText(x, y - 30, `+${pts}`);
        comboCheer(c.combo);
        roundScore += pts;
        addScore(c, pts);
        if (placed === n) setTimeout(finish, 500);
        return true;
      } else {
        c.combo = 0;
        misses++;
        pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
        tile.classList.remove('shake'); void tile.offsetWidth; tile.classList.add('shake');
        sfx.wrong();
        floatText(x, y - 30, 'Try another step', 'bad');
        hearts[maxMiss - misses]?.classList.add('lost');
        if (misses >= maxMiss) setTimeout(finish, 400);
        return false;
      }
    };

    let activeAvatar: HTMLElement | null = null;
    let currentHoverPad: HTMLElement | null = null;
    let dragTile: HTMLButtonElement | null = null;
    let startX = 0, startY = 0, isDragging = false;

    const cleanDrag = () => {
      if (activeAvatar) {
        activeAvatar.remove();
        activeAvatar = null;
      }
      if (dragTile) {
        dragTile.classList.remove('dragging-source');
        dragTile = null;
      }
      if (currentHoverPad) {
        currentHoverPad.classList.remove('drag-hover');
        currentHoverPad = null;
      }
      isDragging = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragTile) return;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!isDragging && dist > 8) {
        isDragging = true;
        sfx.pickup();
        const obj = OBJECTS.find((o) => o.id === dragTile!.dataset.id)!;
        dragTile.classList.add('dragging-source');
        activeAvatar = document.createElement('div');
        activeAvatar.className = 'drag-avatar';
        activeAvatar.innerHTML = `<img src="${obj.img}" alt="${obj.name}" />`;
        document.body.appendChild(activeAvatar);
        pads.forEach((p) => !p.classList.contains('filled') && p.classList.add('target'));
      }
      if (isDragging && activeAvatar) {
        activeAvatar.style.left = `${e.clientX}px`;
        activeAvatar.style.top = `${e.clientY}px`;

        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pad') as HTMLElement | null;
        if (el && pads.includes(el) && !el.classList.contains('filled')) {
          if (currentHoverPad !== el) {
            currentHoverPad?.classList.remove('drag-hover');
            currentHoverPad = el;
            currentHoverPad.classList.add('drag-hover');
          }
        } else if (currentHoverPad) {
          currentHoverPad.classList.remove('drag-hover');
          currentHoverPad = null;
        }
      }
    };

    const onPointerUp = () => {
      if (!dragTile) return;
      const tile = dragTile;
      const targetPad = currentHoverPad;
      const wasDragging = isDragging;
      cleanDrag();

      if (wasDragging && targetPad) {
        const padIndex = pads.indexOf(targetPad);
        if (padIndex >= 0) {
          tryPlace(tile, padIndex);
          return;
        }
      }

      // If it was a quick tap or dropped outside
      if (!wasDragging) {
        if (selected === tile) {
          selected.classList.remove('selected');
          selected = null;
          pads.forEach((p) => p.classList.remove('target'));
        } else {
          selected?.classList.remove('selected');
          selected = tile;
          selected.classList.add('selected');
          pads.forEach((p) => !p.classList.contains('filled') && p.classList.add('target'));
          sfx.tap();
          speak(OBJECTS.find((o) => o.id === tile.dataset.id)!.name);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    document.querySelectorAll<HTMLButtonElement>('.tile').forEach((tile) => {
      tile.onpointerdown = (e) => {
        if (tile.disabled) return;
        dragTile = tile;
        startX = e.clientX;
        startY = e.clientY;
        isDragging = false;
      };
    });

    pads.forEach((pad, i) => {
      pad.onclick = () => {
        if (!selected || pad.classList.contains('filled')) return;
        tryPlace(selected, i);
      };
    });
  });

  pads.forEach((pad, i) => {
    if (!pad.classList.contains('filled')) {
      pad.innerHTML = `<span class="pad-num">${i + 1}</span><img class="obj ghost" src="${items[i].img}" alt="${items[i].name}">`;
    }
  });
  await c.sleep(placed < n ? 2000 : 700);
  return { accuracy: Math.max(0, (placed - misses * 0.25) / n), score: roundScore };
}

/* ---------------- Between rounds & results ---------------- */

async function roundToast(c: Ctx, r: RoundResult) {
  const msg = r.accuracy >= 0.99 ? 'Perfect round!' : r.accuracy >= 0.6 ? 'Nice memory!' : 'Keep going!';
  banner(msg, r.accuracy >= 0.99 ? 'combo' : '');
  if (r.accuracy >= 0.99) { confetti(60); sfx.win(); }
  speak(msg);
  await c.sleep(1400);
}

function starsFor(acc: number) {
  return acc >= 0.9 ? 3 : acc >= 0.65 ? 2 : acc >= 0.4 ? 1 : 0;
}

async function results(c: Ctx, acc: number, hasNext: boolean): Promise<'next' | 'retry' | 'map'> {
  const stars = starsFor(acc);
  const key = `${c.challenge.id}/${c.level.id}`;
  const prevBest = save.best[key] || 0;
  const newTrophies = recordResult(key, stars, c.score, c.combo);
  const passed = stars > 0;

  const trophyHtml = newTrophies.length > 0 ? `
    <div class="trophy-unlock-banner pop-in">
      ${newTrophies.map((t) => `<div class="trophy-pill"><span>${t.emoji}</span> <span>Trophy Unlocked: <b>${t.name}</b></span></div>`).join('')}
    </div>
  ` : '';

  app().innerHTML = `<section class="screen results ${passed ? 'win' : 'lose'}">
    <div class="card pop-in">
      <h1>${passed ? 'Level Complete!' : 'So Close!'}</h1>
      <div class="big-stars">${[0, 1, 2].map((i) => `<span class="big-star" data-i="${i}">★</span>`).join('')}</div>
      <div class="result-score"><small>Score</small><b id="count">0</b>${c.score > prevBest && passed ? '<em class="best pop-in">New best!</em>' : ''}</div>
      <div class="result-acc">Memory accuracy: <b>${Math.round(acc * 100)}%</b></div>
      ${trophyHtml}
      <p class="encourage">${passed ? (stars === 3 ? 'Outstanding! Your memory is razor sharp. 🧠✨' : 'Great work! Replay for 3 stars.') : 'Every try makes your memory stronger. Give it another go!'}</p>
      <div class="result-actions">
        ${passed && hasNext ? '<button class="btn btn-primary btn-big" id="next-btn">Next Level ▶</button>' : ''}
        <button class="btn ${passed && hasNext ? 'btn-ghost' : 'btn-primary btn-big'}" id="retry-btn">↻ Play Again</button>
        <button class="btn btn-ghost" id="map-btn">Map</button>
      </div>
    </div>
  </section>`;

  if (passed) {
    sfx.win();
    confetti();
    setTimeout(() => confetti(90), 900);
    speak(stars === 3 ? 'Outstanding! Three stars!' : `Level complete! ${stars} ${stars === 1 ? 'star' : 'stars'}.`);
  } else speak('So close! Try again.');

  // Count-up score
  const countEl = document.getElementById('count')!;
  const t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, (t - t0) / 1200);
    countEl.textContent = String(Math.round(c.score * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Stars fly in one by one
  const starEls = [...document.querySelectorAll<HTMLElement>('.big-star')];
  starEls.forEach((el, i) => {
    if (i < stars) {
      setTimeout(() => {
        el.classList.add('on');
        const { x, y } = centerOf(el);
        starBurst(x, y);
        blast(x, y, ['#ffc93c', '#fff6c2', '#ff7a45']);
        sfx.star(i);
      }, 600 + i * 450);
    }
  });

  return new Promise((res) => {
    document.getElementById('next-btn')?.addEventListener('click', () => { sfx.tap(); res('next'); });
    document.getElementById('retry-btn')!.onclick = () => { sfx.tap(); res('retry'); };
    document.getElementById('map-btn')!.onclick = () => { sfx.tap(); res('map'); };
  });
}

/* ---------------- Assembly Line: Conveyor Belt Presentation ---------------- */

async function memorizeConveyor(c: Ctx, items: GameObject[]) {
  const n = items.length;
  const isReverse = c.level.id === 'reverse-gear';
  app().innerHTML = `<section class="screen play assembly">
    ${hud(c)}
    <div class="conveyor-stage" style="background-image:url(/bg/assembly.png)">
      ${isReverse ? '<div class="reverse-alert-tag">⚠️ REVERSE GEAR: Remember Backwards!</div>' : ''}
      <div class="conveyor-system">
        <div class="scanner-rig" id="scanner-rig">
          <span class="scanner-head">🤖</span>
          <div class="scanner-beam"></div>
        </div>
        <div class="conveyor-belt-wrap">
          <div class="conveyor-tread ${isReverse ? 'reverse' : ''}"></div>
          <div class="conveyor-pedestal"></div>
        </div>
      </div>
      <div class="conveyor-item-wrap" id="belt-item-wrap"></div>
    </div>
    <p class="caption" id="caption" aria-live="polite">Round ${c.roundIndex + 1}: watch the assembly line…</p>
    <div class="actions" id="actions"></div>
  </section>`;
  bindQuit(c);

  const scannerRig = document.getElementById('scanner-rig')!;
  const itemWrap = document.getElementById('belt-item-wrap')!;
  const caption = document.getElementById('caption')!;

  await c.sleep(600);

  for (let i = 0; i < n; i++) {
    sfx.gear();
    itemWrap.innerHTML = `<img class="conveyor-item-img" src="${items[i].img}" alt="${items[i].name}" />`;
    itemWrap.className = 'conveyor-item-wrap slide-in';
    await c.sleep(350);

    scannerRig.classList.add('active');
    sfx.scan();
    const { x, y } = centerOf(itemWrap);
    sparkle(x, y - 20, 12, 40);
    caption.innerHTML = `${isReverse ? 'Item ' + (i + 1) : '#' + (i + 1)}: <b>${items[i].name}</b>`;
    speak(items[i].name);

    await c.sleep(c.level.stepMs);

    scannerRig.classList.remove('active');
    itemWrap.className = 'conveyor-item-wrap slide-out';
    await c.sleep(280);
    itemWrap.innerHTML = '';
  }

  const actions = document.getElementById('actions')!;
  if (c.level.reviewMs === null) {
    caption.textContent = isReverse
      ? 'Line finished! Remember the order backwards.'
      : 'Line finished! Head to the packing station.';
    actions.innerHTML = `<button class="btn btn-primary btn-big pulse" id="ready-btn">Pack Crates 📦</button>`;
    await new Promise<void>((res) => (document.getElementById('ready-btn')!.onclick = () => { sfx.tap(); res(); }));
  } else {
    const secs = Math.ceil(c.level.reviewMs / 1000);
    caption.textContent = isReverse ? 'Remember in reverse!' : 'Get ready to pack!';
    actions.innerHTML = `<div class="timer" style="--dur:${c.level.reviewMs}ms"><span id="tleft">${secs}</span></div>`;
    for (let s = secs; s > 0; s--) {
      document.getElementById('tleft')!.textContent = String(s);
      await c.sleep(1000);
    }
  }
}

/* ---------------- Assembly Line: Recall Sequence ---------------- */

async function recallSequence(c: Ctx, items: GameObject[], isReverse = false): Promise<RoundResult> {
  const targetItems = isReverse ? [...items].reverse() : items;
  const n = targetItems.length;
  const pool = OBJECTS.filter((o) => !items.includes(o));

  const lookAlikeGroups = new Set(items.map((o) => o.lookAlikeGroup).filter(Boolean));
  const lookAlikePool = pool.filter((o) => o.lookAlikeGroup && lookAlikeGroups.has(o.lookAlikeGroup));
  const genericPool = pool.filter((o) => !lookAlikePool.includes(o));
  const chosenDistractors = [...shuffle(lookAlikePool), ...shuffle(genericPool)].slice(0, c.level.distractors);
  const tray = shuffle([...items, ...chosenDistractors]);
  const maxMiss = 3;

  app().innerHTML = `<section class="screen play classroom assembly-recall" style="background-image:url(/bg/assembly.png)">
    ${hud(c)}
    <h2 class="prompt">
      ${isReverse ? '🔄 Pack in REVERSE order!' : '📦 Pack in exact sequence!'}
      <small>${isReverse ? 'Tap the LAST item that came on the belt first' : 'Tap items in the order they rolled by'}</small>
    </h2>
    <div class="sequence-slots">
      ${targetItems.map((_, i) => `
        <div class="crate-slot" data-i="${i}">
          <span class="crate-tag">${isReverse ? (i === 0 ? '🏁' : n - i) : i + 1}</span>
          <span>?</span>
        </div>
      `).join('')}
    </div>
    <div class="tray">${tray.map((o) => `<button class="tile" data-id="${o.id}" aria-label="${o.name}"><img src="${o.img}" alt=""><span>${o.name}</span></button>`).join('')}</div>
    <div class="misses" aria-label="Misses allowed">${Array.from({ length: maxMiss }, () => '<span class="heart">💖</span>').join('')}</div>
  </section>`;
  bindQuit(c);
  speak(isReverse ? 'Pack items in reverse order!' : 'Pack items in exact sequence!');

  const slots = [...document.querySelectorAll<HTMLElement>('.crate-slot')];
  const hearts = [...document.querySelectorAll<HTMLElement>('.heart')];
  let filled = 0, inOrder = 0, misses = 0, roundScore = 0;

  await new Promise<void>((done) => {
    const finish = () => { document.querySelectorAll<HTMLButtonElement>('.tile').forEach((t) => (t.disabled = true)); done(); };
    document.querySelectorAll<HTMLButtonElement>('.tile').forEach((tile) => {
      tile.onclick = () => {
        if (tile.disabled) return;
        const obj = OBJECTS.find((o) => o.id === tile.dataset.id)!;
        const { x, y } = centerOf(tile);
        const expected = targetItems[filled];
        if (obj === expected) {
          tile.disabled = true;
          tile.classList.add('picked');
          const slot = slots[filled];
          slot.innerHTML = `<span class="crate-tag">${isReverse ? (filled === 0 ? '🏁' : n - filled) : filled + 1}</span><img src="${obj.img}" alt="${obj.name}" class="pop-in">`;
          slot.classList.add('good');
          c.combo++;
          inOrder++;
          const pts = 100 + 25 * Math.min(c.combo - 1, 8);
          blast(x, y);
          sfx.correct(c.combo);
          floatText(x, y - 30, `+${pts}`);
          comboCheer(c.combo);
          const s = centerOf(slot);
          sparkle(s.x, s.y, 8, 25);
          roundScore += pts;
          addScore(c, pts);
          filled++;
          if (filled === n) setTimeout(finish, 500);
        } else {
          c.combo = 0;
          misses++;
          tile.classList.remove('shake'); void tile.offsetWidth; tile.classList.add('shake');
          sfx.wrong();
          floatText(x, y - 30, targetItems.includes(obj) ? 'Wrong position!' : 'Not this item', 'bad');
          hearts[maxMiss - misses]?.classList.add('lost');
          if (misses >= maxMiss) setTimeout(finish, 400);
        }
      };
    });
  });

  for (let i = filled; i < n; i++) {
    slots[i].innerHTML = `<span class="crate-tag">${isReverse ? (i === 0 ? '🏁' : n - i) : i + 1}</span><img src="${targetItems[i].img}" alt="${targetItems[i].name}" class="ghost">`;
    slots[i].classList.add('missed');
  }
  await c.sleep(filled < n ? 1800 : 700);
  return { accuracy: inOrder / n, score: roundScore };
}

/* ---------------- The Grid: Spatial Memory Round ---------------- */

async function playGridRound(c: Ctx, targetCount: number): Promise<RoundResult> {
  const size = c.level.gridSize || 4;
  const totalTiles = size * size;
  const targetIndices = shuffle(Array.from({ length: totalTiles }, (_, i) => i)).slice(0, targetCount);
  const maxMiss = 3;

  app().innerHTML = `<section class="screen play grid-screen" style="background-image:url(/bg/grid.png)">
    ${hud(c)}
    <h2 class="prompt" id="grid-prompt">
      ${c.level.sequential ? (c.level.strictOrder ? '🔢 Tap in the EXACT order!' : '💡 Follow the flashing lights!') : '💡 Remember the pattern!'}
      <small id="grid-sub">${c.level.sequential ? 'Watch the sequence carefully' : 'Memorize which tiles light up'}</small>
    </h2>
    <div class="grid-stage">
      <div class="matrix-container" style="--size:${size}">
        ${Array.from({ length: totalTiles }, (_, i) => `<button class="matrix-tile" data-idx="${i}" disabled aria-label="Tile ${i + 1}"></button>`).join('')}
      </div>
    </div>
    <div class="misses" aria-label="Misses allowed">${Array.from({ length: maxMiss }, () => '<span class="heart">💖</span>').join('')}</div>
  </section>`;
  bindQuit(c);

  const tiles = [...document.querySelectorAll<HTMLButtonElement>('.matrix-tile')];
  const hearts = [...document.querySelectorAll<HTMLElement>('.heart')];
  const prompt = document.getElementById('grid-prompt')!;
  const sub = document.getElementById('grid-sub')!;

  speak(c.level.sequential ? (c.level.strictOrder ? 'Tap in the exact order!' : 'Follow the lights!') : 'Remember the pattern!');
  await c.sleep(700);

  // --- Flash Phase ---
  if (c.level.sequential) {
    for (let step = 0; step < targetIndices.length; step++) {
      const idx = targetIndices[step];
      const tile = tiles[idx];
      tile.classList.add('glowing');
      sfx.gridTile(step);
      const { x, y } = centerOf(tile);
      sparkle(x, y, 10, 30);
      await c.sleep(c.level.stepMs);
      tile.classList.remove('glowing');
      await c.sleep(120);
    }
  } else {
    targetIndices.forEach((idx, i) => {
      tiles[idx].classList.add('glowing');
      const { x, y } = centerOf(tiles[idx]);
      sparkle(x, y, 8, 25);
      setTimeout(() => sfx.gridTile(i), i * 60);
    });
    await c.sleep(c.level.stepMs);
    targetIndices.forEach((idx) => tiles[idx].classList.remove('glowing'));
  }

  await c.sleep(350);

  // --- Recall Phase ---
  sub.textContent = c.level.strictOrder ? 'Tap the tiles in the order they flashed' : 'Tap all the tiles that were glowing';
  prompt.innerHTML = `Your turn! <b>Tap the tiles</b><small>${sub.textContent}</small>`;
  speak('Your turn! Tap the tiles.');

  tiles.forEach((t) => (t.disabled = false));

  let found = 0;
  let misses = 0;
  let roundScore = 0;
  const foundSet = new Set<number>();

  await new Promise<void>((done) => {
    const finish = () => {
      tiles.forEach((t) => (t.disabled = true));
      done();
    };

    tiles.forEach((tile) => {
      tile.onclick = () => {
        if (tile.disabled) return;
        const idx = Number(tile.dataset.idx);
        const { x, y } = centerOf(tile);

        if (c.level.strictOrder) {
          const expected = targetIndices[found];
          if (idx === expected) {
            tile.disabled = true;
            tile.classList.add('correct');
            tile.innerHTML = `<span class="matrix-badge">${found + 1}</span>`;
            c.combo++;
            found++;
            foundSet.add(idx);
            const pts = 100 + 25 * Math.min(c.combo - 1, 8);
            blast(x, y);
            sfx.gridTile(found);
            floatText(x, y - 25, `+${pts}`);
            comboCheer(c.combo);
            roundScore += pts;
            addScore(c, pts);
            if (found === targetCount) setTimeout(finish, 500);
          } else {
            c.combo = 0;
            misses++;
            tile.classList.remove('wrong'); void tile.offsetWidth; tile.classList.add('wrong');
            sfx.wrong();
            floatText(x, y - 25, targetIndices.includes(idx) ? 'Wrong order!' : 'Not this tile', 'bad');
            hearts[maxMiss - misses]?.classList.add('lost');
            if (misses >= maxMiss) setTimeout(finish, 400);
          }
        } else {
          if (targetIndices.includes(idx) && !foundSet.has(idx)) {
            tile.disabled = true;
            tile.classList.add('correct');
            tile.innerHTML = `<span class="matrix-badge">✓</span>`;
            c.combo++;
            found++;
            foundSet.add(idx);
            const pts = 100 + 25 * Math.min(c.combo - 1, 8);
            blast(x, y);
            sfx.gridTile(found);
            floatText(x, y - 25, `+${pts}`);
            comboCheer(c.combo);
            roundScore += pts;
            addScore(c, pts);
            if (found === targetCount) setTimeout(finish, 500);
          } else {
            c.combo = 0;
            misses++;
            tile.classList.remove('wrong'); void tile.offsetWidth; tile.classList.add('wrong');
            sfx.wrong();
            floatText(x, y - 25, 'Not this tile', 'bad');
            hearts[maxMiss - misses]?.classList.add('lost');
            if (misses >= maxMiss) setTimeout(finish, 400);
          }
        }
      };
    });
  });

  // Reveal missed tiles
  targetIndices.forEach((idx, i) => {
    if (!foundSet.has(idx)) {
      tiles[idx].classList.add('missed-reveal');
      tiles[idx].innerHTML = `<span class="matrix-badge">${c.level.strictOrder ? i + 1 : '●'}</span>`;
    }
  });

  await c.sleep(found < targetCount ? 1800 : 700);
  return { accuracy: Math.max(0, (found - misses * 0.25) / targetCount), score: roundScore };
}

/* ---------------- Challenge 4: The Daily Routine ---------------- */

const ROUTINE_PAIRS: [string, string][] = [
  ['clock', 'watch'],
  ['cup', 'mug'],
  ['bell', 'guitar'],
  ['hat', 'cap'],
  ['book', 'pencil'],
  ['key', 'umbrella'],
  ['lamp', 'book'],
  ['apple', 'cup'],
];

async function playRoutineRound(c: Ctx, count: number): Promise<RoundResult> {
  const subMode = c.level.routineSubMode || 'where';

  // Submode 1: Perfect Pair (associative matching)
  if (subMode === 'pair') {
    const availablePairs = shuffle(ROUTINE_PAIRS).slice(0, count);
    const leftItems: GameObject[] = [];
    const rightItems: GameObject[] = [];
    const pairMap = new Map<string, string>();

    availablePairs.forEach(([idA, idB]) => {
      const objA = OBJECTS.find((o) => o.id === idA)!;
      const objB = OBJECTS.find((o) => o.id === idB)!;
      leftItems.push(objA);
      rightItems.push(objB);
      pairMap.set(objA.id, objB.id);
      pairMap.set(objB.id, objA.id);
    });

    const shuffledLeft = shuffle(leftItems);
    const shuffledRight = shuffle(rightItems);

    app().innerHTML = `<section class="screen">
      ${hud(c)}
      <div class="tray-title">Match items that belong together in daily life!</div>
      <div class="pair-board">
        <div class="pair-col" id="pair-col-left">
          ${shuffledLeft.map((o) => `
            <button class="pair-card" data-id="${o.id}">
              <img src="${o.img}" alt="${o.name}">
              <span>${o.name}</span>
            </button>
          `).join('')}
        </div>
        <div class="pair-col" id="pair-col-right">
          ${shuffledRight.map((o) => `
            <button class="pair-card" data-id="${o.id}">
              <img src="${o.img}" alt="${o.name}">
              <span>${o.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </section>`;

    bindQuit(c);
    speak('Tap an item, then tap its matching pair!');

    let selectedLeftId: string | null = null;
    let selectedLeftBtn: HTMLButtonElement | null = null;
    let matchedCount = 0;
    let misses = 0;
    let roundScore = 0;

    await new Promise<void>((res) => {
      const leftBtns = document.querySelectorAll<HTMLButtonElement>('#pair-col-left .pair-card');
      const rightBtns = document.querySelectorAll<HTMLButtonElement>('#pair-col-right .pair-card');

      leftBtns.forEach((btn) => {
        btn.onclick = () => {
          if (btn.classList.contains('matched')) return;
          sfx.tap();
          leftBtns.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedLeftId = btn.dataset.id!;
          selectedLeftBtn = btn;
          speak(btn.querySelector('span')!.textContent || '');
        };
      });

      rightBtns.forEach((btn) => {
        btn.onclick = () => {
          if (btn.classList.contains('matched')) return;
          if (!selectedLeftId || !selectedLeftBtn) {
            floatText(centerOf(btn).x, centerOf(btn).y - 20, 'Select left card first!', 'bad');
            sfx.wrong();
            return;
          }

          const rightId = btn.dataset.id!;
          const { x, y } = centerOf(btn);

          if (pairMap.get(selectedLeftId) === rightId) {
            btn.classList.add('matched');
            btn.disabled = true;
            selectedLeftBtn.classList.remove('selected');
            selectedLeftBtn.classList.add('matched');
            selectedLeftBtn.disabled = true;

            c.combo++;
            matchedCount++;
            const pts = 120 + 25 * Math.min(c.combo - 1, 8);
            roundScore += pts;
            addScore(c, pts);
            blast(x, y);
            sfx.correct(c.combo);
            comboCheer(c.combo);
            floatText(x, y - 25, `+${pts}`);

            selectedLeftId = null;
            selectedLeftBtn = null;

            if (matchedCount === count) setTimeout(res, 600);
          } else {
            c.combo = 0;
            misses++;
            btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
            sfx.wrong();
            floatText(x, y - 25, 'Not a pair', 'bad');
          }
        };
      });
    });

    return { accuracy: Math.max(0, (matchedCount - misses * 0.25) / count), score: roundScore };
  }

  // Common room setup for where / missing / changed / detective
  const spots = shuffle(ROOM_SPOTS).slice(0, count);
  const items = shuffle(OBJECTS).slice(0, count);

  // Memorize Phase
  app().innerHTML = `<section class="screen">
    ${hud(c)}
    <div class="tray-title" id="room-prompt">Memorize where each object is resting in the room!</div>
    <div class="routine-stage" id="routine-stage">
      ${spots.map((s, i) => `
        <div class="room-spot" style="left:${s.x}%; top:${s.y}%;">
          <img class="room-item-img" src="${items[i].img}" alt="${items[i].name}">
        </div>
      `).join('')}
    </div>
    <div style="display:flex; justify-content:center; margin-top:0.6rem;">
      <button class="btn btn-primary btn-big pulse" id="routine-ready">Ready!</button>
    </div>
  </section>`;

  bindQuit(c);
  sfx.spotReveal();
  speak('Take a look at where everything is resting in the room.');

  await new Promise<void>((res) => {
    const readyBtn = document.getElementById('routine-ready')!;
    readyBtn.onclick = () => { sfx.tap(); res(); };
    if (c.level.reviewMs) {
      setTimeout(res, c.level.reviewMs);
    }
  });

  sfx.whoosh();

  // Submode 2: Where was it?
  if (subMode === 'where') {
    let found = 0;
    let misses = 0;
    let roundScore = 0;

    const askOrder = shuffle([...Array(count).keys()]);

    for (const itemIdx of askOrder) {
      const targetItem = items[itemIdx];

      app().innerHTML = `<section class="screen">
        ${hud(c)}
        <div class="tray-title">Where was the <b>${targetItem.name}</b> placed?</div>
        <div class="routine-stage" id="routine-stage">
          ${spots.map((s, i) => `
            <button class="room-spot target-spot" data-idx="${i}" style="left:${s.x}%; top:${s.y}%;" aria-label="${s.name}">
              <span class="room-spot-marker">?</span>
            </button>
          `).join('')}
        </div>
        <div style="display:flex; align-items:center; justify-content:center; gap:0.6rem; margin-top:0.6rem;">
          <img src="${targetItem.img}" alt="${targetItem.name}" style="width:48px; height:48px; object-fit:contain;">
          <span style="font-weight:800; font-size:1.15rem; color:var(--gold);">${targetItem.name}</span>
        </div>
      </section>`;

      bindQuit(c);
      speak(`Where was the ${targetItem.name}?`);

      await new Promise<void>((res) => {
        document.querySelectorAll<HTMLButtonElement>('.room-spot.target-spot').forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            const { x, y } = centerOf(btn);

            if (idx === itemIdx) {
              btn.innerHTML = `<img class="room-item-img" src="${targetItem.img}" alt="${targetItem.name}">`;
              btn.classList.remove('target-spot');
              c.combo++;
              found++;
              const pts = 120 + 25 * Math.min(c.combo - 1, 8);
              roundScore += pts;
              addScore(c, pts);
              blast(x, y);
              sfx.correct(c.combo);
              comboCheer(c.combo);
              floatText(x, y - 25, `+${pts}`);
              setTimeout(res, 500);
            } else {
              c.combo = 0;
              misses++;
              btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
              sfx.wrong();
              floatText(x, y - 25, 'Wrong spot!', 'bad');
            }
          };
        });
      });
    }

    return { accuracy: Math.max(0, (found - misses * 0.25) / count), score: roundScore };
  }

  // Submode 3: What's Missing?
  if (subMode === 'missing') {
    const missingIdx = Math.floor(Math.random() * count);
    const missingItem = items[missingIdx];
    const distractorPool = shuffle(OBJECTS.filter((o) => !items.includes(o))).slice(0, 3);
    const trayOptions = shuffle([missingItem, ...distractorPool]);

    app().innerHTML = `<section class="screen">
      ${hud(c)}
      <div class="tray-title">🔍 One item vanished from the room! Which one is missing?</div>
      <div class="routine-stage has-tray" id="routine-stage">
        ${spots.map((s, i) => `
          <div class="room-spot" style="left:${s.x}%; top:${s.y}%;">
            ${i === missingIdx ? `<span class="room-spot-marker" style="opacity:0.6;">?</span>` : `<img class="room-item-img" src="${items[i].img}" alt="${items[i].name}">`}
          </div>
        `).join('')}
      </div>
      <div class="tray ${trayOptions.length > 3 ? 'small' : ''}" id="missing-tray" style="margin-top:0.8rem;">
        ${trayOptions.map((o) => `
          <button class="tile" data-id="${o.id}" aria-label="${o.name}">
            <img src="${o.img}" alt="${o.name}">
            <span>${o.name}</span>
          </button>
        `).join('')}
      </div>
    </section>`;

    bindQuit(c);
    sfx.mystery();
    speak('One item vanished! Which one is missing?');

    let roundScore = 0;
    let misses = 0;

    const result = await new Promise<RoundResult>((res) => {
      document.querySelectorAll<HTMLButtonElement>('#missing-tray .tile').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.id!;
          const { x, y } = centerOf(btn);

          if (id === missingItem.id) {
            btn.classList.add('correct');
            c.combo++;
            const pts = 200 + 50 * Math.min(c.combo - 1, 5);
            roundScore += pts;
            addScore(c, pts);
            blast(x, y);
            sfx.correct(c.combo);
            starBurst(innerWidth / 2, innerHeight / 2);
            floatText(x, y - 25, `+${pts}`);
            res({ accuracy: Math.max(0, 1 - misses * 0.4), score: roundScore });
          } else {
            c.combo = 0;
            misses++;
            btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
            sfx.wrong();
            floatText(x, y - 25, 'Not this item', 'bad');
          }
        };
      });
    });

    return result;
  }

  // Submode 4 & 5: Something Changed / Routine Detective
  const isDetective = subMode === 'detective';
  const changedIdx = Math.floor(Math.random() * count);
  const lookAlikeReplacements: Record<string, string> = {
    clock: 'watch', watch: 'clock',
    hat: 'cap', cap: 'hat',
    cup: 'mug', mug: 'cup',
    bell: 'guitar', guitar: 'bell',
  };
  const original = items[changedIdx];
  const replacementId = lookAlikeReplacements[original.id] || (items[(changedIdx + 1) % count].id);
  const replacementItem = OBJECTS.find((o) => o.id === replacementId) || OBJECTS[0];

  const vanishedIdx = isDetective ? (changedIdx + 1) % count : -1;

  app().innerHTML = `<section class="screen">
    ${hud(c)}
    <div class="tray-title">🔍 ${isDetective ? 'Two anomalies in the room! Tap the changed and missing spots.' : 'Something changed in the room! Tap the anomaly spot.'}</div>
    <div class="routine-stage" id="routine-stage">
      ${spots.map((s, i) => {
        let content = `<img class="room-item-img" src="${items[i].img}" alt="${items[i].name}">`;
        if (i === changedIdx) {
          content = `<img class="room-item-img" src="${replacementItem.img}" alt="${replacementItem.name}">`;
        } else if (i === vanishedIdx) {
          content = `<span class="room-spot-marker" style="opacity:0.7;">?</span>`;
        }
        return `<button class="room-spot target-spot" data-idx="${i}" style="left:${s.x}%; top:${s.y}%;">${content}</button>`;
      }).join('')}
    </div>
  </section>`;

  bindQuit(c);
  sfx.mystery();
  speak('Look closely... what changed in the room?');

  let roundScore = 0;
  let misses = 0;
  const targets = new Set([changedIdx, ...(vanishedIdx >= 0 ? [vanishedIdx] : [])]);
  const foundSpots = new Set<number>();

  const result = await new Promise<RoundResult>((res) => {
    document.querySelectorAll<HTMLButtonElement>('.room-spot.target-spot').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const { x, y } = centerOf(btn);

        if (targets.has(idx) && !foundSpots.has(idx)) {
          foundSpots.add(idx);
          btn.classList.add('correct');
          btn.style.borderColor = '#10ac84';
          c.combo++;
          const pts = 180 + 30 * Math.min(c.combo - 1, 5);
          roundScore += pts;
          addScore(c, pts);
          blast(x, y);
          sfx.correct(c.combo);
          floatText(x, y - 25, `Spotted! +${pts}`);

          if (foundSpots.size === targets.size) {
            starBurst(innerWidth / 2, innerHeight / 2);
            setTimeout(() => res({ accuracy: Math.max(0, 1 - misses * 0.3), score: roundScore }), 600);
          }
        } else {
          c.combo = 0;
          misses++;
          btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
          sfx.wrong();
          floatText(x, y - 25, 'Nothing changed here', 'bad');
        }
      };
    });
  });

  return result;
}

/* ---------------- Challenge 5: The Audio-Visual Link ---------------- */

const AUDIO_OBJECT_IDS = ['bell', 'guitar', 'clock', 'watch', 'ball', 'cup', 'mug', 'key', 'lamp', 'book', 'umbrella', 'apple'];

async function playAudioRound(c: Ctx, count: number): Promise<RoundResult> {
  const subMode = c.level.audioSubMode || 'hear';
  const availableObjects = shuffle(OBJECTS.filter((o) => AUDIO_OBJECT_IDS.includes(o.id)));

  // Submode 1 & 2: Hear & Find / Sound Match
  if (subMode === 'hear' || subMode === 'match') {
    const target = availableObjects[0];
    const distractorCount = Math.min(c.level.distractors || 2, 3);
    const candidates = shuffle([target, ...availableObjects.slice(1, distractorCount + 1)]);

    app().innerHTML = `<section class="screen">
      ${hud(c)}
      <div class="audio-prompt-box">
        <h2 class="audio-prompt-title">🎵 Listen & Match</h2>
        <p class="audio-prompt-sub" id="audio-sub">Listen to the mystery sound, then tap the matching item!</p>
      </div>
      <div class="audio-stage has-tray">
        <div class="sound-pod">
          <div class="speaker-avatar pulse" id="speaker-pod" role="button" aria-label="Replay sound" title="Tap to listen">🔊</div>
          <div class="audio-pulse-ring active" id="pulse-ring"></div>
        </div>
        <div class="equalizer-bar-wrap" id="eq-bars">
          <div class="eq-bar active"></div>
          <div class="eq-bar active" style="animation-delay:0.1s"></div>
          <div class="eq-bar active" style="animation-delay:0.2s"></div>
          <div class="eq-bar active" style="animation-delay:0.15s"></div>
          <div class="eq-bar active" style="animation-delay:0.25s"></div>
        </div>
        <button class="btn btn-secondary btn-pill" id="replay-sound" style="font-size:0.9rem; padding:0.35rem 1.1rem; min-height:0; margin-top:0.2rem;">▶ Replay Sound</button>
      </div>
      <div class="tray ${candidates.length > 3 ? 'small' : ''}" id="audio-tray" style="margin-top:0.6rem; max-width:440px;">
        ${candidates.map((o) => `
          <button class="tile audio-tile" data-id="${o.id}" aria-label="${o.name}">
            <img src="${o.img}" alt="${o.name}">
            <span>${o.name}</span>
            <span class="tile-audio-tag">🔊 listen</span>
          </button>
        `).join('')}
      </div>
    </section>`;

    bindQuit(c);

    const playCue = () => {
      sfx.objectSound(target.id);
      const ring = document.getElementById('pulse-ring');
      if (ring) { ring.classList.remove('active'); void ring.offsetWidth; ring.classList.add('active'); }
      const spk = document.getElementById('speaker-pod');
      if (spk) { spk.classList.remove('pulse'); void spk.offsetWidth; spk.classList.add('pulse'); }
      const bars = document.querySelectorAll('.eq-bar');
      bars.forEach((b) => b.classList.add('active'));
      setTimeout(() => bars.forEach((b) => b.classList.remove('active')), 600);
    };

    setTimeout(playCue, 400);
    document.getElementById('replay-sound')!.onclick = () => { sfx.tap(); playCue(); };
    document.getElementById('speaker-pod')!.onclick = () => { sfx.tap(); playCue(); };

    let roundScore = 0;
    let misses = 0;
    let locked = false;

    const result = await new Promise<RoundResult>((res) => {
      document.querySelectorAll<HTMLButtonElement>('#audio-tray .tile').forEach((btn) => {
        btn.onclick = () => {
          if (locked) return;
          const id = btn.dataset.id!;
          const obj = OBJECTS.find((o) => o.id === id) || { name: id };
          const { x, y } = centerOf(btn);

          sfx.objectSound(id);

          if (id === target.id) {
            locked = true;
            btn.classList.add('good');
            c.combo++;
            const pts = 150 + 30 * Math.min(c.combo - 1, 8);
            roundScore += pts;
            addScore(c, pts);
            blast(x, y);
            sfx.correct(c.combo);
            starBurst(innerWidth / 2, innerHeight / 2);
            floatText(x, y - 25, `+${pts}`);
            const sub = document.getElementById('audio-sub');
            if (sub) sub.textContent = `✨ Correct! That's the ${target.name}!`;
            setTimeout(() => res({ accuracy: Math.max(0, 1 - misses * 0.35), score: roundScore }), 750);
          } else {
            c.combo = 0;
            misses++;
            btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
            sfx.wrong();
            floatText(x, y - 25, `That's the ${obj.name}!`, 'bad');
            const sub = document.getElementById('audio-sub');
            if (sub) sub.textContent = `That was the ${obj.name}! Listen to the sound again...`;
            setTimeout(() => {
              playCue();
            }, 700);
          }
        };
      });
    });

    return result;
  }

  // Submode 3, 4, 5: Listen in Order / Sound Chain / Sound Master
  const sequence = availableObjects.slice(0, count);
  const distractorCount = c.level.distractors || 2;
  const distractors = shuffle(OBJECTS.filter((o) => !sequence.includes(o))).slice(0, distractorCount);
  const trayCards = shuffle([...sequence, ...distractors]);

  app().innerHTML = `<section class="screen">
    ${hud(c)}
    <div class="audio-prompt-box">
      <h2 class="audio-prompt-title" id="audio-title">🎵 Listen carefully to the rhythm sequence...</h2>
      <p class="audio-prompt-sub">Remember the order of the sounds!</p>
    </div>
    <div class="audio-stage">
      <div class="sound-pod">
        <div class="speaker-avatar" id="speaker-pod">🔊</div>
        <div class="audio-pulse-ring" id="pulse-ring"></div>
      </div>
      <div class="equalizer-bar-wrap" id="eq-bars">
        <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
      </div>
      <div class="audio-slots" id="audio-slots">
        ${sequence.map((_, i) => `<div class="audio-slot" data-slot="${i}"><span>${i + 1}</span></div>`).join('')}
      </div>
    </div>
  </section>`;

  bindQuit(c);
  speak('Listen to the sounds in order!');
  await c.sleep(700);

  // Play sequence
  const playSeq = async () => {
    const ring = document.getElementById('pulse-ring');
    const spk = document.getElementById('speaker-pod');
    const bars = document.querySelectorAll('.eq-bar');

    for (let i = 0; i < sequence.length; i++) {
      const item = sequence[i];
      if (ring) { ring.classList.remove('active'); void ring.offsetWidth; ring.classList.add('active'); }
      if (spk) { spk.classList.remove('pulse'); void spk.offsetWidth; spk.classList.add('pulse'); }
      bars.forEach((b) => b.classList.add('active'));

      sfx.objectSound(item.id);

      const slot = document.querySelector(`.audio-slot[data-slot="${i}"]`);
      if (slot) {
        slot.classList.add('filled');
        if (subMode !== 'master') {
          slot.innerHTML = `<img src="${item.img}" alt="${item.name}">`;
        }
      }

      await c.sleep(c.level.stepMs || 800);
      bars.forEach((b) => b.classList.remove('active'));
    }

    // Reset slots for recall
    document.querySelectorAll('.audio-slot').forEach((slot, i) => {
      slot.classList.remove('filled');
      slot.innerHTML = `<span>${i + 1}</span>`;
    });
  };

  await playSeq();

  // Recall Phase
  document.querySelector('.audio-stage')?.classList.add('has-tray');
  const titleEl = document.getElementById('audio-title');
  if (titleEl) titleEl.textContent = 'Tap the objects in the EXACT order you heard!';
  speak('Tap the objects in order!');

  const recallTray = document.createElement('div');
  recallTray.className = `tray ${trayCards.length > 3 ? 'small' : ''}`;
  recallTray.id = 'audio-recall-tray';
  recallTray.style.marginTop = '0.5rem';
  recallTray.style.maxWidth = '440px';
  recallTray.innerHTML = trayCards.map((o) => `
    <button class="tile audio-tile" data-id="${o.id}" aria-label="${o.name}">
      <img src="${o.img}" alt="${o.name}">
      <span>${o.name}</span>
    </button>
  `).join('');

  document.querySelector('.screen')!.appendChild(recallTray);

  let placed = 0;
  let misses = 0;
  let roundScore = 0;

  const result = await new Promise<RoundResult>((res) => {
    document.querySelectorAll<HTMLButtonElement>('#audio-recall-tray .tile').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id!;
        const expected = sequence[placed];
        const { x, y } = centerOf(btn);

        sfx.objectSound(id);

        if (id === expected.id) {
          const slot = document.querySelector(`.audio-slot[data-slot="${placed}"]`);
          if (slot) {
            slot.classList.add('filled');
            slot.innerHTML = `<img src="${expected.img}" alt="${expected.name}">`;
          }

          btn.classList.add('correct');
          btn.disabled = true;
          c.combo++;
          placed++;
          const pts = 120 + 25 * Math.min(c.combo - 1, 8);
          roundScore += pts;
          addScore(c, pts);
          blast(x, y);
          sfx.correct(c.combo);
          floatText(x, y - 25, `+${pts}`);

          if (placed === sequence.length) {
            comboCheer(c.combo);
            starBurst(innerWidth / 2, innerHeight / 2);
            setTimeout(() => res({ accuracy: Math.max(0, 1 - misses * 0.25), score: roundScore }), 600);
          }
        } else {
          c.combo = 0;
          misses++;
          btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
          sfx.wrong();
          floatText(x, y - 25, 'Wrong order!', 'bad');
        }
      };
    });
  });

  return result;
}

/* ---------------- Item Selector Helper ---------------- */

function selectRoundItems(c: Ctx, count: number): GameObject[] {
  if (c.level.id === 'look-alike') {
    const pairs: GameObject[][] = [
      OBJECTS.filter((o) => o.id === 'clock' || o.id === 'watch'),
      OBJECTS.filter((o) => o.id === 'hat' || o.id === 'cap'),
      OBJECTS.filter((o) => o.id === 'cup' || o.id === 'mug'),
      OBJECTS.filter((o) => o.id === 'bell' || o.id === 'guitar'),
    ];
    const picked: GameObject[] = [];
    shuffle(pairs).forEach((pair) => {
      if (picked.length < count && pair.length === 2) {
        picked.push(...pair);
      }
    });
    const rest = shuffle(OBJECTS.filter((o) => !picked.includes(o)));
    return shuffle([...picked, ...rest]).slice(0, count);
  }
  return shuffle(OBJECTS).slice(0, count);
}

/* ---------------- Level flow ---------------- */

export async function playLevel(
  challenge: ChallengeDef,
  levels: LevelDef[],
  levelIndex: number,
  onExit: () => void
): Promise<void> {
  const id = ++session;
  const level = levels[levelIndex];
  const c: Ctx = { challenge, level, levelIndex, roundIndex: 0, score: 0, combo: 0, sleep: makeSleep(id), onExit };
  try {
    await intro(c);
    if (id !== session) return;
    const accs: number[] = [];
    for (let r = 0; r < level.rounds.length; r++) {
      c.roundIndex = r;
      let res: RoundResult;

      if (challenge.id === 'grid') {
        res = await playGridRound(c, level.rounds[r]);
      } else if (challenge.id === 'assembly') {
        const items = selectRoundItems(c, level.rounds[r]);
        await memorizeConveyor(c, items);
        sfx.whoosh();
        res = await recallSequence(c, items, level.id === 'reverse-gear');
      } else if (challenge.id === 'routine') {
        res = await playRoutineRound(c, level.rounds[r]);
      } else if (challenge.id === 'audio') {
        res = await playAudioRound(c, level.rounds[r]);
      } else {
        const items = selectRoundItems(c, level.rounds[r]);
        await memorize(c, items);
        sfx.whoosh();
        res = level.mode === 'place' ? await recallPlace(c, items) : await recallPick(c, items);
      }

      accs.push(res.accuracy);
      if (r < level.rounds.length - 1) await roundToast(c, res);
    }
    const acc = accs.reduce((a, b) => a + b, 0) / accs.length;
    const choice = await results(c, acc, levelIndex < levels.length - 1);
    if (id !== session) return;
    if (choice === 'next') return playLevel(challenge, levels, levelIndex + 1, onExit);
    if (choice === 'retry') return playLevel(challenge, levels, levelIndex, onExit);
    onExit();
  } catch (e) {
    if (!(e instanceof Aborted)) throw e;
  }
}
