# Attur — Vertical Slice Plan (Challenge 1: The Virtual Staircase)

## Concept
Recreates the school-corridor memory game: the player **walks up a staircase** where objects sit on steps, then **enters the classroom** and recalls them (which objects, then which order/step). Candy-Crush-style juice on every correct answer.

## Stack
- **Vite + TypeScript**, vanilla CSS design system, no framework (fast, small).
- **Canvas 2D particle engine** (own, ~300 lines) for blasts, sparkles, confetti, star bursts, combo text. Lighter than PixiJS; easy to disable for reduced-motion.
- **PWA**: manifest + service worker → installable on phones/tablets.
- **Web Speech API** for voice narration (no backend).
- Progress saved in `localStorage`.

## Project layout (`c:\dev\attur\app`)
```
src/
  data/challenges.json     # data-driven challenges → levels → rounds
  data/objects.json        # object catalog (id, name, image, category, look-alike group)
  engine/particles.ts      # blast / sparkle / confetti / burst
  engine/audio.ts          # SFX (WebAudio synth) + narration (speechSynthesis)
  engine/store.ts          # progress, stars, settings
  screens/home.ts          # title, play, settings
  screens/map.ts           # Candy-Crush style level path
  screens/staircase.ts     # walk-up / memorize phase
  screens/recall.ts        # classroom recall phase
  screens/results.ts       # stars, score, confetti
  styles/index.css         # tokens, themes (default, high-contrast, large text)
public/objects/*.png       # AI-generated object art
```

## Level design (data-driven, 2–4 rounds each)
| # | Level | Mechanic |
|---|-------|----------|
| 1 | First Step | 3–4 objects, untimed walk, pick them from a tray |
| 2 | Look Again | Timed viewing (e.g. 8s), 4–5 objects |
| 3 | Climbing Higher | 6–8 objects, distractors in tray |
| 4 | Right Step | Drag each object to the exact step it was on |
| 5 | Staircase Master | Some objects vanish mid-walk; recall all + order |

Scoring: points per correct item, **order bonus**, **combo streak** multiplier, 1–3 stars per level. Wrong answer = gentle shake, never harsh.

## Effects & feel
- Correct pick: card pops → **radial blast + sparkles**, rising "+100" text, chime that climbs in pitch with combo.
- Combo ×3/×5: "Sweet!/Brilliant!" banner with star burst.
- Level clear: **confetti cannon**, stars fly into slots one by one, map node unlocks with glow.
- Ambient: floating sparkles on map, bouncy buttons, smooth screen transitions.

## Accessibility (built in)
- **Large text** toggle (scales root font + tap targets ≥ 56px).
- **High-contrast** theme.
- **Voice narration**: reads instructions and object names on tap; toggle in settings.

## Art
Generate ~20 objects (ball, hat, cap, bat, umbrella, book, apple, clock, bell, key, shoe, cup, kite, teddy, lamp, pencil, glasses, guitar, sunflower, watch) in one consistent glossy cartoon style, plus a staircase/corridor background and classroom background.

## Verification
- `npm run build` passes type-check.
- Browser run-through of all 5 levels; screenshots of map, memorize, recall, results; check high-contrast + large-text.

## Open questions
1. App name on screen: just **"Attur"**, or with a tagline (e.g. "Attur — Remember the Way")?
2. OK to start levels with **sound on** (SFX synthesized, no audio files)?
