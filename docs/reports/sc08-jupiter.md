# SC08 · Jupiter: Project Installations, acceptance report

**Status:** built, awaiting approval. Overlays (three flagship panels at rest 0.25 / 0.5 / 0.75) pre-existing.

## What it is
- `src/chapters/jupiter/` (`jupiter.ts` data and camera, `Jupiter.tsx`, `Stations.tsx`, `jupiter.test.ts`).
- Jupiter (NASA/JPL/SSI Cassini map, A026) low right, so the installations read against dark space.
- Three installations, each with a silhouette that echoes its project's architecture:
  - SmartWay Traffic: road ring with detection cameras on the rim and a blinking beacon.
  - DocumentDB: stacked archive plates on a spine with orbiting retrieval nodes.
  - Stash: framed vault cube with a pulsing core and saved-item flags.
- Ambient only: station spin, light blink, band drift (clock time, no story meaning).

## Project Bay (added after the first review)
- "Enter Project Bay" on each installation panel opens `src/ui/ProjectBay.tsx`: a native modal dialog (focus trap, Esc closes, focus returns to the opener, background inert, the page never scrolls behind it; the scroll position is restored exactly).
- Layout follows PROJECT_PRESENTATION_PLAN §5: title, role, one-line purpose, media, "What it does", "How it's built" (stack), links, Close. Everything comes from `src/content/`; nothing is invented.
- Media: real project images re-encoded by `npm run assets:projects` (A027–A029).
- Tests: `e2e/journey.spec.ts` "project bay" (opens, scroll trapped, Esc restores the frame and focus), desktop and phone-portrait.
- Not in the Bay yet: dates (not in source), the "simple architecture sketch" (needs confirmed architecture facts, not invented), the interactive SmartWay mini-scene.
- **Stash's image looks like a design mockup** (placeholder URL, user@email.com), not a real screenshot: please confirm or supply a real one.

## Fixes from review (same session)
- Installations were unclear: now 1.7× bigger, whiter hulls, emissive panels, a local fill light, and placed off the planet.
- SC06: the Earth was an unreadable dark arc. Now a whole globe (Asia/India), day side with oceans on the right, city lights on the night side, terminator and sunrise glare.
- SC07: planets were passed sideways. Now a chase camera; the Moon and Mars grow ahead and sweep past close; the lit Earth shrinks behind the bow at the start.

## Evidence
- `npm run verify` 72/72 · `npm run build` OK · `npm run test:e2e` 20/20.
- `--perf`: 49–75 draw calls, 29–33k triangles, 50 live textures, p95 ≈ 17 ms (headless).

## Open
- Station detail is code-built; Blender-built models could replace them in P5.
- Android untested.
