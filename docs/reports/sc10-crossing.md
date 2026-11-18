# SC10 · The Edge & The Crossing: acceptance report

**Status:** built, awaiting approval. No overlay (spec: none, or one line to confirm).

## What it is
- **Art-style blend** (the engine part): `src/shaders/styleBlend.ts`, a screen-space pass after tone mapping. `uStyle` 0 = realistic, 1 = ink line art on paper, 2 = flat cel colour with ink lines and a painted sky behind dark areas. A chapter may export `style(t)`; otherwise its art style decides (`anime` → 2). The Director writes `frame.style` each tick and a `StyleSync` component copies it to the pass: no React state, a pure function of scroll, fully reversible. SC11 areas (anime) render at style 2 already; SC12 will use `style(t)` to run it backwards.
- **Chapter** `src/chapters/crossing/` (`crossing.ts` maths, `Crossing.tsx`, `crossing.test.ts`) and `src/shaders/crossing.ts`: the cold quiet edge (a far small Sun, sparse icy dust) → the gate (gold ring, counter-rotating ring, swirling lens anomaly that opens on approach) → a tunnel (ambient flow) → emergence into a painted sky (warm sun, flat clouds). The far side and tunnel are hidden until just before entry so the reveal is not spoiled.
- Style curve: realistic until the gate, line art ramps up inside it, cel colour floods before the exit and holds.
- Low tier has no post chain, so it gets a minimal composer (tone mapping + style pass) only while a `beyond` chapter is within the warm window.

## Evidence
- `npm run verify` 80/80 · `npm run build` OK · `npm run test:e2e` 22/22.
- `--perf`: 30–34 draw calls, 66–75k triangles, p95 ≈ 17 ms (headless). Frames reviewed at t = 0.05, 0.4, 0.5, 0.58, 0.8, 0.97 (desktop) and 0.5, 0.58 (Low).

## Open
- The cockpit beat (visor reflecting the gate) is not built.
- The painted sky and clouds are stand-ins; the real anime-universe art direction is designed later (ANIME_UNIVERSE_FRAMEWORK).
- Cel look uses 4 luminance levels; a per-area palette could come with SC11.
- Not tested on Android.
