# Chapter Acceptance Report: SC05 · Ignition & Ascent

> Date: 2026-11-17 · Phase: P4 (first chapter) · Status: **complete, awaiting your approval**

| | |
|---|---|
| Chapter | `sc05-ascent`: Ignition & Ascent |
| Storyboard scenes covered | FINAL_STORYLINE SC05 (= Batch 1 S06 Ignition + S07 Ascent, merged) |
| Content keys used | **none**, as specified ("a deliberate breath") |
| Assets | **no files**: everything is code-built (ship, pad, tower, plume, smoke, clouds, sky). Nothing new to register in `assets/ASSET_REGISTER.md`, and no downloads were needed |
| Rest points | none (as in the registry) |
| Tests | unit **55/55** (5 new for SC05), e2e **20/20** (desktop + Pixel 7, axe included; 2 new), `npm run build` ✅ |

## What you'll see (scroll forward)
| t | Beat | Shot |
|---|---|---|
| 0.00–0.17 | Night pad under floodlights; the crew access arm swings away from the hatch | **Wide locked shot**, slow push in |
| 0.10–0.25 | Ignition: the bells glow, the plume builds, smoke billows out of the flame trench lit orange, the hold-down clamps retract | Light camera shake |
| 0.25 | **Liftoff** (slow off the pad, then accelerating) | The aim follows the ship up past the tower |
| 0.27–0.60 | Climbing; the ground and pad fall away | **Tracking alongside**, rising with the ship |
| 0.60–0.80 | Through the cloud deck, the plume lighting the clouds from inside | **Hull-mounted onboard camera** looking up past the lit cabin windows (cut) |
| 0.80–1.00 | Out above the deck; the sky goes black and the stars come out; the view lifts to the horizon: black space over a thin glowing line, the dark Earth below | **Above and beside**, then a tilt to the horizon (cut). The hand-off to SC06's Earth limb |

## Built
- **The spacecraft** (`src/chapters/ship/Spacecraft.tsx`): the character for every space chapter, built to PROJECT_VISION §8. It's a compact crew vehicle (12.5 m) with no fins:
  - panel-seamed white hull and a gold ring;
  - a **heat-tile shield on one face** (kept away from camera here; it pays off at the Sun);
  - crew windows with warm cabin light, and a side hatch facing the tower;
  - two rings of RCS quads, stowed landing legs, and three engine bells that glow from inside;
  - named parts (`Ship_Hatch`, `Ship_Engines`, `Ship_RCS`, …) per the asset pipeline rules.
  
  **The room window in SC02 now shows this same ship** (it was a grey-box capsule), so the ship you see from the desk is the one that launches.
- **Exhaust** (`src/shaders/plume.ts`): a white-hot core turning to orange, shock diamonds at sea level, and a wider, bluer, fainter plume in thin air. A wide orange outer glow surrounds it. Flicker is ambient only. There is a reduced-cost variant for Low.
- **Atmosphere** (`src/shaders/atmosphere.ts`): a camera-centred sky dome that darkens with altitude; a ground plane that dissolves into the horizon; 6 cloud layers (3 on Low) with moonlit tops, lit from below by the plume near the ship; and smoke billboards.
- **Pad**: lattice tower (one instanced draw), crew access arm, launch mount, clamps, flame trench, floodlight masts, red beacons and distant settlement lights. A procedural night environment map gives the hull its reflections.
- **Story maths** (`src/chapters/ascent/ascent.ts`): a pure function of t, so scrolling back plays the launch backwards exactly. It is tested in node.

## Found and fixed along the way (not SC05-specific)
1. **A passed overlay could stay on screen** (engine bug from P2). The overlay `ref` callback re-ran on every re-render and reset the Director's record of the panel, so after a long jump SC04's Education panel stayed visible over SC05. It showed up in the portrait captures.
   - Fix in `Journey.tsx`.
   - New e2e regression test, **verified to fail without the fix and pass with it** on both devices.
2. **GPU memory leak in the room chapters (from P3).** Every SC02/SC03 remount leaked about 228 buffers and 7–9 textures:
   - suit hardware geometry was built per clone;
   - skeleton bone textures were never disposed;
   - `usePbrMaterial` never disposed its material or texture clones.
   
   All three are fixed. Buffers are now flat across repeated round trips.
3. The suit geometry is now shared at module scope, so SC02, SC03 and SC04 no longer build their own copies.

## Measured (Radeon 780M, headless Chrome 1440×900; frame times are capped by 60 Hz pacing)
| | Balanced | Low |
|---|---|---|
| Frame time p95 at t = 0.2 / 0.45 / 0.7 / 0.85 | 17.1 / 17.0 / 17.0 / 16.9 ms | 16.9 / 17.0 / 17.0 / 17.2 ms |
| Draw calls per frame (incl. post-processing passes) | 121 / 98 / 65 / 98 | 98 / 75 / 42 / 75 |
| Triangles per frame | 8–12k | 7–11k |
| Download | **0 bytes of assets**; ≤ 16.5 KB gzipped of code (upper bound, measured on source) | same |

**Memory after exit vs baseline** (SC02 → SC05 → SC02 × 3, live GPU objects):
- SC05's own resources return to steady state: buffers at SC05 were 354 → 371 → 363 across three visits.
- Overall, buffers no longer grow (before the fixes they grew by +228 per trip).
- Textures still creep **by about +3 per round trip, and the control run shows this without SC05 mounted at all**. It's a smaller pre-existing leak in the room or grey-box chapters, so I've logged it below instead of chasing it inside this chapter.

Method: `node scripts/capture-shots.ts … --perf`. It now also counts draw calls, triangles and live textures/buffers by wrapping WebGL in the test browser only; there's no app change.

## Screenshots
- Desktop: `spike-results/shots/desktop/sc05-ascent-{0.06,0.2,0.3,0.45,0.66,0.74,0.85,0.97}.png`
- Portrait: `spike-results/shots/portrait/sc05-ascent-{0.2,0.45,0.7,0.85,0.97}.png`
- Room window with the new ship: `spike-results/shots/desktop/sc02-room-0.06.png`
- **Recording:** none. I review captured frames, not video; forward/reverse exactness is covered by the purity tests.

## Known issues / deviations
- **Night launch**, not "the sky going blue": it follows from the room's night window, so the sky goes from night navy to black. SC06's sunrise then lands as the first daylight.
- **The climb is compressed** (cloud deck at ~360–520 m, ship to ~1.15 km) to stay inside the camera's 2 km far plane. At night this is invisible.
- **The onboard shot is the weakest frame**: it's readable (hull, lit windows, clouds rushing in), but less striking than the others.
- **Pad smoke reads warm beige** near the plume (exhaust-lit steam). Cooler grey is a one-line change if you prefer.
- **Reduced motion:** the camera shake is off; there is no stills/photo-story system yet (the app shows the existing notice pointing to the Mission Brief).
- **Bundle:** the journey chunk is 468 KB gzipped against the 350 KB target. Most of that predates SC05 (P3 post-processing, loaders and astronaut); SC05 adds at most ~16.5 KB. This is still planned for P5.
- **Pre-existing texture creep** (about +3 per SC02 remount, see Measured), for the performance phase.
- **Android not measured**, as for P3.

## Decisions needed from you
1. **The spacecraft design.** It will appear in every space chapter, so it's worth confirming now. Is the code-built look right, or would you rather I source a free (CC0/CC-BY) model for your approval?
2. Night launch: OK?
3. Shot grammar: blended push → tracking, then **hard cuts** to the onboard camera and the above-the-clouds shot. OK, or would you prefer continuous moves?

## Rework after approval (2026-11-17): the HelVela II
You supplied two models in `raw-assets/` and chose the warship as the hero ship, with the launch reworked.
- **Ship:** "HelVela II" (Sketchfab, CC BY, A024). The source is 1.43 M triangles in 215 meshes. The pipeline (`npm run assets:ship`) removed 161 hidden nodes: 8 fighters in an internal hangar, 16 interior seat/cockpit sets, and an unplaced full-size turret that floated beside the hull. It was then simplified to **62k triangles, 6 draw calls, 248 KB**. The model's textures were missing, so the materials are rebuilt from its own names: a gunmetal hull and its cyan, red, white and yellow lights.
- **Launch is now VTOL:** the ship sits on two cradles beside the tower. The crew arm swings off the hull and the clamps fall away. Four belly lift-jets raise it to a hover at ~28 m; then it pitches up to ~31° and climbs forward on its stern thrusters. Same shots and cuts: wide → tracking → deck camera through the clouds → above the deck → horizon.
- The room window now shows the HelVela on its pad.
- Tests rewritten for the new geometry (5 SC05 tests: beat order, cloud crossing, camera never inside the 60 m hull or the tower, purity). All 59 unit and 20 e2e tests pass.
- **Open:** the Sketchfab URL and author for the credit line (CC BY requires it).

## Approval
✅ **Approved by you on 2026-11-17** ("ok approved, start SC06"). The three open decisions were accepted as built: the code-built spacecraft, a night launch, and hard cuts to the onboard and above-the-clouds shots.

Next: **SC06 · Orbital Sunrise (Core Strengths)**. It needs your confirmation of the 3–5 strengths (FINAL_STORYLINE SC06 lists a proposal drawn only from the source).
