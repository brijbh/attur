import { OBJECTS, type ChallengeDef, type GameObject, type LevelDef } from './data';
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
  app().innerHTML = `<section class="screen intro-screen">
    <div class="card pop-in">
      <div class="intro-badge">Level ${c.levelIndex + 1}</div>
      <h1>${c.level.name}</h1>
      <p>${c.level.intro}</p>
      <ul class="intro-facts">
        <li>🎯 ${c.level.rounds.length} rounds</li>
        <li>${c.level.reviewMs === null ? '🐢 No timer' : '⏱️ Timed'}</li>
        <li>${c.level.mode === 'place' ? '🪜 Place on steps' : '🔢 Recall in order'}</li>
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
      <div class="walker" id="walker" aria-hidden="true">🧒</div>
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
    walker.style.top = `${y - 9}%`;
  };
  moveWalker(70, 99);
  await c.sleep(700);

  for (let i = 0; i < n; i++) {
    const p = padPos(i, n);
    moveWalker(p.x, p.y);
    walker.classList.remove('hop'); void walker.offsetWidth; walker.classList.add('hop');
    sfx.step();
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
  sfx.whoosh();

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
  const tray = shuffle([...items, ...shuffle(pool).slice(0, c.level.distractors)]);
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
    <h2 class="prompt compact">Put each object back on its step<small>Tap an object, then tap a step</small></h2>
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
    const finish = () => done();
    document.querySelectorAll<HTMLButtonElement>('.tile').forEach((tile) => {
      tile.onclick = () => {
        if (tile.disabled) return;
        selected?.classList.remove('selected');
        selected = tile;
        tile.classList.add('selected');
        pads.forEach((p) => !p.classList.contains('filled') && p.classList.add('target'));
        sfx.tap();
        speak(OBJECTS.find((o) => o.id === tile.dataset.id)!.name);
      };
    });
    pads.forEach((pad, i) => {
      pad.onclick = () => {
        if (!selected || pad.classList.contains('filled')) return;
        const obj = OBJECTS.find((o) => o.id === selected!.dataset.id)!;
        const { x, y } = centerOf(pad);
        if (items[i] === obj) {
          c.combo++;
          placed++;
          const pts = 100 + 25 * Math.min(c.combo - 1, 8);
          pad.innerHTML = `<span class="pad-num">${i + 1}</span><img class="obj pop-in" src="${obj.img}" alt="${obj.name}">`;
          pad.classList.add('filled', 'lit');
          selected.disabled = true;
          selected.classList.remove('selected');
          selected.classList.add('picked');
          selected = null;
          pads.forEach((p) => p.classList.remove('target'));
          blast(x, y);
          sfx.correct(c.combo);
          floatText(x, y - 30, `+${pts}`);
          comboCheer(c.combo);
          roundScore += pts;
          addScore(c, pts);
          if (placed === n) setTimeout(finish, 500);
        } else {
          c.combo = 0;
          misses++;
          pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
          sfx.wrong();
          floatText(x, y - 30, 'Try another step', 'bad');
          hearts[maxMiss - misses]?.classList.add('lost');
          if (misses >= maxMiss) setTimeout(finish, 400);
        }
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
  recordResult(key, stars, c.score);
  const passed = stars > 0;
  app().innerHTML = `<section class="screen results ${passed ? 'win' : 'lose'}">
    <div class="card pop-in">
      <h1>${passed ? 'Level Complete!' : 'So Close!'}</h1>
      <div class="big-stars">${[0, 1, 2].map((i) => `<span class="big-star" data-i="${i}">★</span>`).join('')}</div>
      <div class="result-score"><small>Score</small><b id="count">0</b>${c.score > prevBest && passed ? '<em class="best pop-in">New best!</em>' : ''}</div>
      <div class="result-acc">Memory accuracy: <b>${Math.round(acc * 100)}%</b></div>
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
      const items = shuffle(OBJECTS).slice(0, level.rounds[r]);
      await memorize(c, items);
      sfx.whoosh();
      const res = level.mode === 'place' ? await recallPlace(c, items) : await recallPick(c, items);
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
