# SC13 · Homecoming & Final Transmission: acceptance report

**Status:** built, awaiting approval. This completes all 13 chapters.

## What it is
- `src/chapters/homecoming/` (`homecoming.ts` maths, `Homecoming.tsx`, `homecoming.test.ts`).
- The HelVela in high orbit above a lit Earth (NASA A021/A022) at sunrise, earthshine on the hull. Camera: wide over the limb → medium on the deck with the astronaut at frame right and the contact panel on the left; a long hold to the end.
- The (Mixamo) astronaut steps onto a code-built exterior deck, walks foot-locked (clip phase from distance), stands, and turns toward the camera; a golden beacon then rises on the deck and pulses outward (ambient). All story motion is a pure function of t and tested.
- The contact panel (same `ContactPanel` as the Brief and header dialog) plus a **Replay mission** button (jumps back to the first chapter).

## Evidence
`npm run verify` 93/93 · build OK · e2e 22/22. `--perf`: 55–57 draw calls, 161k triangles. Frames reviewed at t = 0.03, 0.2, 0.6.

## Not built / open
- The "completed emblem locks into place" is not built (needs a decision on how the emblem appears: DOM or in-scene).
- The beacon is partly hidden behind hull turrets at the medium shot; the deck position may need a tweak.
- The standing pose is the end frame of the stand-up clip (no idle clip yet).
- Not tested on Android.
