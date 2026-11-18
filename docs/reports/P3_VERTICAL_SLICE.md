# P3 Report: Vertical Slice (SC02 Room → SC03 Departure → SC04 Cockpit)

> Date: 2026-11-16 (astronaut added 2026-11-17) · Status: **✅ approved by you on 2026-11-17** ("ok start with p4", after the review corrections below)

## Decisions taken with you
- Poly Haven **CC0** assets approved for the room and cockpit.
- Astronaut via **Mixamo** (your download), with the code-built stand-in kept until then.

## What changed on screen
| Scene | Before (P2 grey box) | Now |
|---|---|---|
| SC02 Room | Boxes and a capsule | Futuristic room: textured metal panels, painted-concrete floor, warm and cool light strips, Poly Haven desk, leather chair, anglepoise lamp, plant, notepads, shelf, ceiling lamp; three monitors showing this portfolio's real source code; the night launch pad with the ship through the window |
| SC03 Departure | Capsule slides to a door | The astronaut turns from the desk, walks to a **sliding sci-fi door**, steps through into white light (match cut to the hatch); the camera follows |
| SC04 Cockpit | Boxes | Curved panelled hull, angled console, switch banks, two seats (one empty), windscreen onto the floodlit tower, **three diegetic screens rendering your Crew Record** (experience, flight plan, education) from the content module |

Lighting is real-time (no Blender bake): HDRI reflections (Balanced) or procedural RoomEnvironment (Low, 0 bytes), one shadow-casting key, practical lights, plus bloom, SMAA and AgX tone mapping on Balanced.

## Assets (all CC0, registered A010–A019 in `assets/ASSET_REGISTER.md`)
| | Raw | Optimised |
|---|---|---|
| 7 models (≈55k triangles total) | 11.4 MB | **3.1 MB** (KTX2 ETC1S + Meshopt, no simplify) |
| 2 PBR texture sets (6 maps) | 4.2 MB | **1.2 MB** KTX2 |
| HDRI (Balanced only) | 1.6 MB | 1.6 MB |

The pipeline is repeatable: `npm run assets:fetch` → `npm run assets:optimize`.

## Measured
| Check | Result |
|---|---|
| Frame time, Radeon 780M, headless Chrome 1440×900, Balanced (bloom + SMAA + shadows + HDRI) | SC02 p95 17.1 ms · SC03 16.9 · SC04 17.0. **60 fps, no dropped frames** |
| Same, Low tier | p95 16.8–17.1 ms |
| `npm run verify` | ✅ 45/45 unit tests |
| `npm run test:e2e` (desktop + Pixel 7 portrait) | ✅ 18/18, 0 axe violations |
| Portrait framing (room, cockpit) | ✅ reviewed |

Caveat: frame times are capped by 60 Hz pacing, so this shows "keeps up", not headroom. **Android: still not measured.**

## Bugs found and fixed in this phase (all from reviewing captured frames)
1. **The chair faced away from the desk**: wrong rotation assumption about the model's forward axis.
2. **The night view through the window was grey.** Root cause, confirmed in the three.js source: with `scene.environment`, a material's `envMapIntensity` is ignored, so the huge exterior ground reflected the room IBL by Fresnel at grazing angles. Fixed with non-IBL materials outside.
3. **Double tone mapping** (renderer AgX + post AgX) lifted every night frame to blue-grey. Now exactly one stage owns it. This would have affected every space chapter.
4. **Bloom haze**: the threshold was too low and pad lights too bright.
5. **The camera passed through the astronaut** at the SC03 door and SC04 Experience screen. Paths recomputed against the subject's position.
6. **The astronaut faced the camera** while walking away. Heading is now computed from the direction of travel.

The lessons are recorded in `.claude/skills/r3f-scenes/SKILL.md` so later chapters don't repeat them.

## The astronaut (added 2026-11-17)
- Mixamo **Y Bot** + clips you downloaded, converted **without any extra tool** (three.js FBXLoader + GLTFExporter in Chrome, `npm run assets:mixamo`): 10.3 MB → **602 KB**.
- Dressed in code: off-white suit, dark joints, **helmet with gold visor** on the head bone (faceless, as decided).
- Clip directions verified from data, not guessed: "Standing" hips 41 → 100 cm = **stand up**; "Sitting" hips 98 → 61 cm = **sit down**.
- Walking was downloaded **without In Place** (hips travelled 177 cm); fixed in the converter by pinning horizontal root motion.
- SC02: seated, typing (ambient loop). SC03: stand up → one continuous foot-locked walk to the door and through it (pure function of t, reverses exactly). SC04: seated idle in the pilot seat.
- Measured with the character in: p95 ≤ 17.2 ms on both tiers (60 fps).
- Found and fixed: **the chair was backwards** (my P3 "fix" was wrong; the real seated pose made it unambiguous).

## Corrections from your review (2026-11-17)
| You said | Cause | Fix |
|---|---|---|
| Suit isn't proper or like a real suit; needs to be clear | Bare Y Bot mannequin painted white, with dark robot joint rings | `astronaut/suit.ts`: off-white fabric (soft sheen); joint rings become light-grey bellows; **charcoal gloves, boots and shoulder yokes** painted from the skin weights (the model has no UVs); body inflated about 1.2 cm along *welded* normals so it reads as a suit over a body; new helmet (shell, visor frame, gold visor, hinge pods, neck seal with lock ring), collar, wrist rings, thigh umbilical connector and shoulder patch, all placed by raycasting the real body surface |
| Typing is too fast | Clip played at 1× wall-clock time | 0.5× (`TYPING_RATE` in `origin.tsx`) |
| Chair blends into the body while standing and walking | The straight seat-to-door walk went through the chair, and the chair never moved | The chair is **pushed back 0.7 m and swung** while the astronaut stands. The walk is now a smooth curve: step right along the desk, then arc to the door. A unit test checks the body stays at least 20 cm clear of the chair footprint |
| Room door isn't proper | One slab slid out into the room past the wall; black gap with stars behind it | `room/SlidingDoor.tsx`: framed **bi-parting door** with leaves that retract into wall pockets, a reveal with depth, light lines, a status light (red → green), a bright corridor beyond, and light spilling onto the floor as it opens. It opens from the walker's distance, so it's always fully open before they reach it (tested) |

Also found and fixed: **the cockpit rendered unlit after a jump.** This was an IBL lifetime bug, not HDRI load time: SC02 unmounting unregistered the "room" environment that SC03 and SC04 share. It is now unregistered only when its last user leaves.

Checked after the corrections: `npm run verify` passes 50/50 (5 new departure tests); `npm run build` passes; `npm run test:e2e` passes 18/18. Frame time p95 is 17.0–17.3 ms on Balanced and 17.0–17.2 ms on Low (60 fps, display-capped).

## Not done / honest gaps
- **Breathing Idle.fbx contains no animation** (0 tracks). Only needed for SC13 later; please re-download it some time (Skin: Without Skin).
- The character is **55k triangles**, over the 30k character budget. Fine on the 780M (measured); revisit for Android.
- ~~A first direct jump to the cockpit can show it unlit~~: root cause found and fixed (see Corrections). A cold first load of the HDRI can still take a moment.
- The suit is still built on the Y Bot body shape, so it's a good likeness of a fitted IVA suit rather than a sculpted suit model. A rigged CC0/CC-BY suit model would go further (needs your approval of a source).
- **No baked lighting**: real-time only (you chose not to require Blender). It looks good on the 780M; a bake would add soft contact shadows.
- Monitors, keyboard, cockpit and door are code-built (no free CC0 sci-fi cockpit exists); they're deliberately simple shapes with real materials and content.
- **Bundle:** the HDRI is 1.6 MB on Balanced only; total first-scene download ≈ 5.9 MB plus JS, inside the 8 MB budget.
- Android performance, Lenis feel test and the P5 bundle-size work remain open.

## Next
1. Your review of the slice (`npm run dev` → http://localhost:5173).
2. Then P4: the remaining chapters one at a time, each through the same capture → review → fix loop.
