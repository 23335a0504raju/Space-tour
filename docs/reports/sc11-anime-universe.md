# SC11 · The Anime-Inspired Universe: acceptance report

**Status:** built as generic stand-ins (structure only, per ANIME_UNIVERSE_FRAMEWORK), awaiting approval.

## What it is
- `src/chapters/anime/`: `anime.ts` (areas, cameras, landmarks; unit-tested), `parts.tsx` (sky dome, islands, torii, ring mandala, spires, motes, light road, ringed planet, clouds), `areas.tsx` (the three chapters), `clouds.ts` (shared with SC10).
- All three render in the SC10 style pass at style 2 (cel colour + ink outlines): flat-shaded primitives, gradient sky domes the pass flattens into painted bands.
- **Discipline** (dawn pink/red): SC10's sky continues with no cut (same clouds and sun, same first camera; `seamlessFromPrevious`); the cloud deck sinks away as the ship climbs; a procession of torii gates to fly through; a ring mandala beside the flight line. Panel (certifications) on the right.
- **Proof** (teal/yellow day): floating islands with spires topped by glowing stars on the right; panel (achievements) on the left.
- **Horizon** (lavender dusk): a ringed planet, a road of light along the flight line, motes of stars; panel on the right.
- Between areas a warm-white flash carries the visitor on (`exitColor`). Ambient: ring spin, star spin, shimmer.
- Tests: SC11-A's first camera equals SC10's last; at each rest point the landmark sits opposite the panel; cameras path-independent.

## Content finding
- The Horizon panel (currently learning, future direction) would have been an empty box: both facts are still `missing(...)`. Panels can now declare `available()`; Horizon is omitted until Raju supplies those two facts.

## Evidence
- `npm run verify` 85/85 · `npm run build` OK · `npm run test:e2e` 22/22. Frames reviewed at the rest point of each area plus Discipline's start.

## Not built / open
- The astronaut in toon shading at one moment per area (looking out or on the hull).
- Real worlds and art direction (the stand-ins are deliberately generic).
- Not tested on Android.
