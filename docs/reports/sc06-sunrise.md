# SC06 · Orbital Sunrise: acceptance report

**Status:** built, awaiting approval. Overlay (core strengths) pre-existing, rest point 0.7.

## What it is
- `src/chapters/sunrise/` (maths `sunrise.ts`, scene `Sunrise.tsx`, test `sunrise.test.ts`) and `src/shaders/earth.ts`.
- Earth night side with city lights → Sun rises over the limb (pure function of t) → Moon in the distance → ship turns outward and burns at the end.
- Textures: NASA public domain (A021–A023), 2K day, 2K night, 1K Moon.

## Lessons
- KTX2 maps are not Y-flipped: sample with `1 - v` in custom shaders (the lights landed in the ocean otherwise).
- The Black Marble map's land is blue; isolate city lights by warmth (red over blue), not luminance.
- 8-bit radial gradients band under additive blending: dither the alpha.

## Evidence
- `npm run verify` 62/62 · `npm run build` OK · `npm run test:e2e` 20/20.
- `--perf`: 30–31 draw calls, 96–99k triangles, 57 live textures, p95 17.1–17.2 ms (headless).
- Console on the dev/preview page: only the library's THREE.Clock deprecation warning.

## Open
- Sun glare is a sprite; a lens-flare pass may come in P5.
- Not tested on Android.
