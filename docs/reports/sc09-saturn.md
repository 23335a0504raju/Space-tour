# SC09 · Saturn: Stack Rings, acceptance report

**Status:** built, awaiting approval. Overlay (technology stack, rest 0.75) pre-existing.

## What it is
- `src/chapters/saturn/` (`saturn.ts` story data, `Saturn.tsx`, `saturn.test.ts`) and `src/shaders/saturn.ts`. Fully procedural: no new assets.
- Backlit: the Sun is behind the planet. The planet is dark with a glowing limb; the rings glow by forward scattering; the planet casts a real shadow across them (ray-sphere test per fragment).
- Camera starts edge-on far away and rises on an arc so the rings open (rest point 0.75 shows the whole system, planet right of the left-hand panel).
- Five ring bands = the five stack groups; each lights in its own tint, one after another, and all are lit at the rest point (`bandLevel`, pure in t). The gap between bands 3 and 4 is a Cassini-style division.
- 1,600 ring dust points near the lens.

## Evidence
- `npm run verify` 76/76 · `npm run build` OK · `npm run test:e2e` 20/20.
- `--perf`: 24 draw calls, 12.9k triangles, 50 live textures, p95 ≈ 17 ms (headless).

## Open
- Band tints are not yet tied to the group names on the panel (the panel lists groups in order; a legend could be added).
- Not tested on Android.
