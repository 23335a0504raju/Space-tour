# SC12 · The Return: acceptance report

**Status:** built, awaiting approval. No overlay (spec: linear, no text).

## What it is
- `src/chapters/return/` (`return.ts` maths, `Return.tsx`, `return.test.ts`). The crossing in reverse, reusing the SC10 style pass: `styleAt(t)` runs cel colour (2) → ink line art (1) → real rendering (0) while the ship passes through the gate and the tunnel; a pure function of t, so it re-draws exactly when scrolled back.
- Starts in SC11's painted sky (same sky dome, clouds, sun), flies into the gate (flow in the tunnel runs 2.5× faster than SC10), and emerges into real space: real stars return only after the painted sky is behind, then a lit Earth (NASA maps A021/A022) with the sun rising at its left limb and the Moon (A023). The camera drifts out and sideways for a calm finish.
- Which world is on stage (painted, tunnel, real) is toggled as a function of t.

## Evidence
- `npm run verify` 89/89 · `npm run build` OK · `npm run test:e2e` 22/22.
- `--perf`: 28–32 draw calls, 64–99k triangles, 51–54 live textures. Frames reviewed at t = 0.03, 0.45, 0.97.

## Open
- The hand-over into SC13 (Earth at sunrise with the ship in high orbit) needs the ship to arrive in that scene; SC13 is still a grey-box.
- Small ship fragments drift near the hull (also seen in SC07): to investigate in P5.
- Not tested on Android.
