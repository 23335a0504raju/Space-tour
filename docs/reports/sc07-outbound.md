# SC07 · Outbound: acceptance report

**Status:** built, awaiting approval. Overlay (supporting-project names as links, rest 0.8) pre-existing.

## What it is
- `src/chapters/outbound/` (maths `outbound.ts`, scene `Outbound.tsx`, tests `outbound.test.ts`).
- Planets: Moon, Mercury (starboard, moon map tinted: a stand-in until a Mercury map is added) and Mars, each passed head-on; atmosphere haze is now a soft fresnel rim (no hard ring).
- HelVela flies 1000 m down -z (pure function of t). Moon (NASA, A023) passed close on the left, Mars (Viking mosaic, A025) swept on the left, then 700 instanced asteroids (350 on Low).
- The camera is the ship's profile tracker: relative offset keys plus the ship's z. The key light travels with the ship, so each body shows a different phase.
- Beacons are the existing DOM overlay links (no 3D hit-testing yet; names only, per spec).

## Evidence
- `npm run verify` 69/69, `npm run build` OK, `npm run test:e2e` 20/20.
- `--perf`: 27–31 draw calls, 120–150k triangles, 51 live textures, p95 17.1–17.2 ms (headless).

## Notes
- The first frame of a capture run is black while the KTX2 textures load; capture a throwaway t first.
- Viewed from the lit side a body is a crescent near the terminator; keys are chosen so Moon and Mars show their lit face.

## Open
- Engine plume on the HelVela is only the emissive engine material (no plume shader yet).
- Not tested on Android.

## Also this session: scroll pacing
- One wheel flick used to carry the whole story. `engine/scroll/pacing.ts` + `usePacedWheel.ts`: each wheel event moves a target by at most 90 px (gain 0.55), and the page follows at most 18 px/frame (~1 screen/s); scrub smoothing 0.6 → 0.9 s.
- Browser check: 30 wheel events of 400 px moved the page 8.8% of the story in ~1 s, while still easing (it used to jump to the end). Touch, keyboard and scrollbar stay native.
