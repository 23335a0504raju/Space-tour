# Fix list (post-build revisions)

Status: **identified, not started.** Fix one at a time, in the order below, and get approval after each. Update the status line of each item as it moves.
File pointers are best guesses from the build notes. Confirm them before editing.

Suggested order: 1 → 7 → 8 → 4 → 3 → 2 → 5 → 6.
Reason: scroll feel affects the review of everything else. Typography (7) comes before the start screen (8), because the start screen uses those fonts and colours. The interior items (4, 3) share files. Item 6 needs the user's content and goes last.

---

## 1. Scroll and screen out of sync
**Status:** done, approved 2026-11-18 (see `docs/reports/fix-01-08.md`) · **Area:** `engine/scroll/pacing.ts`, `engine/scroll/usePacedWheel.ts`

**Problem.** After an aggressive scroll forward, the screen replays the movement slowly. The scene keeps travelling long after the user stops. The scroll input is fast and the visuals are slow, so they drift apart.

**Likely cause.** Input is accumulated faster than the smoothed progress can consume it. The scrub is 0.9 s, and the pacing `gain` and `maxSpeed` queue up the input. The visible position lags behind a target that is already far ahead.

**Target behaviour.**
- The visible position tracks the scroll target closely, with a short, constant lag.
- Scrolling fast makes the scene move fast, up to a speed cap. Input beyond the cap is **discarded**, not queued.
- When the user stops, the scene stops within about 0.3 s. It never drains a backlog.
- Reverse scrolling stays exact (pure function of progress).

**Approach to evaluate.**
- Clamp the distance between target and displayed progress to a maximum "lead".
- Lower the scrub time.
- Drop the queued remainder on wheel idle.
- Keep `maxSpeed` as the real limiter.

**Done when.**
- A hard flick of 2 s followed by stopping settles in ≤ 0.5 s.
- No continued drift after input ends.
- Test with mouse wheel, trackpad, touch and keyboard.
- `npm run verify`, `npm run build` and the e2e suite pass.

---

## 2. Asteroids and satellites → real ones
**Status:** built 2026-11-18, awaiting review (Bennu-based belt; Landsat 8, Voyager, Juno as project craft) · **Area:** `chapters/outbound/` (belt), `chapters/jupiter/Stations.tsx` (project installations), any satellite and asteroid meshes

**Problem.**
- The asteroids look made-up and are not in a proper order.
- The satellites and installations that represent the user's projects look invented.

**Requirement.**
- Planets, Earth and the Moon stay as they are.
- Asteroids: use real shapes. Use NASA 3D models of real asteroids (for example Bennu, Ryugu, Eros, Itokawa, Vesta), or NASA photo textures. Lay the belt out as a believable field, not random clutter.
- Satellites: use real spacecraft and satellite models (NASA 3D Resources, for example Juno, Hubble, ISS). Place them in a sensible orbit order.
- Each project installation should read as a real satellite or probe, with a clear mapping to its project.

**Open questions for the user.**
- Which satellite maps to which project (SmartWay Traffic, DocumentDB, Stash)?
- Keep the road ring, archive plates and vault cube as concepts, or replace them fully with real craft?

**Rules.**
- Free assets only (NASA is public domain).
- Register every asset in `assets/ASSET_REGISTER.md` before committing.
- Optimise with the asset-pipeline skill (Meshopt and KTX2).
- Stay inside the performance budgets.

---

## 3. Room walls, floor and seats look like train iron plates
**Status:** built 2026-11-18, awaiting review (code-built panels, deck grating, rounded crew couches, handrail, hatch, cable run; Poly Haven plate textures removed) · **Area:** `room/` (layout, materials), `greybox/origin.tsx`, `cockpit/Cockpit.tsx` (seats)

**Problem.** Walls and floor look like riveted iron plates from a train. It looks awkward and not like a space ship.

**Requirement.**
- Walls: clean, modern spacecraft interior panels. Smooth composite or white panels, soft recessed lighting, handrails, hatches and cable runs, with a clear panel hierarchy. Not dense rivets and plate seams.
- Floor: grated or non-slip deck with subtle texture and light strips. It must not look like checker plate.
- Seats: **real crew seats**. Use a Crew Dragon, Orion or shuttle style reclined couch with harness and headrest. Replace the current sculpted seats.

**Approach.**
- Reference first: agree on 2–3 reference images with the user.
- Prefer free GLB seat or interior models, otherwise a better procedural build.
- Share the materials with item 4.

**Done when.** The user approves frames from SC02–SC05 (capture with `capture-shots.ts`).

---

## 4. Ship interior / cockpit should feel like a real pilot view
**Status:** done, approved 2026-11-18 (Crew Dragon style) · **Area:** `chapters/cockpit/Cockpit.tsx`, SC04 camera shots

**Problem.** The cockpit has three random screens floating in the room. It does not look like a spacecraft or aircraft cockpit.

**Requirement.** Pilot's-eye view from a rocket or aeroplane:
- A curved dashboard (glare shield) in front of the seat.
- A windscreen frame with pillars.
- Instrument panels at plausible positions: a primary flight display, a centre console, an overhead panel, and a throttle and side stick.
- Switches, buttons and indicator lights.
- Seat headrests and harness visible at the edges of the frame.
- Screens sit **inside** the panel, never floating.
- The camera sits at the pilot's eye height, looking out through the windscreen.

**Open question.** Reference style: Space Shuttle, Crew Dragon (touchscreen, minimal) or a fighter jet? The user to choose.

**Done when.** The user approves SC04 frames, including the launch view (VTOL launch, HelVela II hero ship stays).

---

## 5. Portal → black hole (Interstellar style)
**Status:** built 2026-11-18, awaiting review (SC10 and SC12 share `crossing/BlackHole.tsx`) · **Area:** `chapters/crossing/` (SC10), `shaders/crossing.ts`, the SC11 entry points, `shaders/styleBlend.ts` (style hand-off)

**Problem.** The portal does not feel like a black hole.

**Requirement.**
- Reference: *Interstellar*, Gargantua. It has a black event horizon sphere, a thin bright accretion disk, gravitational lensing that bends the disk over the top and bottom, and a photon ring.
- Motion: the camera **falls into** the black hole, with lensing, stretching and a warp towards the centre.
- The "portals" you designed (the anime-area entries) are reached through the fall. The camera exits into the SC11 areas.
- Keep the SC10 → SC11-A `seamlessFromPrevious` hand-off and the realistic → ink → cel style blend.

**Approach.**
- A screen-space or raymarched lensing shader, with a cheap fallback for the low tier (Android).
- Pure function of `t`, so reverse scroll is exact.
- Budget: ≤ the existing SC10 cost. Verify with `--perf` and `--low`.

**Open questions.**
- How many portals, and what do they look like when you reach them?
- Does the fall pass through the disk plane, or fall straight in?

---

## 6. Anime worlds (SC11) — content and characters
**Status:** parked until the end · **Area:** `chapters/anime/`, the SC11 content in `src/content/`

**Plan.** The user will supply characters, text and everything needed. Do not touch this until then.
- SC11 stays as generic stand-in worlds for now.
- The astronaut in toon shading is not built (open item).
- The Horizon panel (SC11-C) is still hidden until its facts exist.

**Needs from the user.** Character art or models, story text, area list, and the "currently learning" and "future direction" text.

---

## 7. Typography, colour, placement and cards
**Status:** blocked on the user's spec · **Area:** `src/ui/` (overlays.tsx, ProjectBay and CSS), global styles, `src/content/` for copy

**Plan.** The user will describe exactly what they want. Collect the spec first, then apply it in one pass.

**Spec to collect.**
| Item | User decision |
|---|---|
| Heading font | |
| Body font | |
| Font sizes and weights | |
| Text colours (primary, secondary, accent) | |
| Text placement per chapter (position, alignment, width) | |
| Card style (shape, border, background, blur, shadow) | |
| Card placement and animation | |
| Project Bay layout | |
| Mobile and portrait layout | |

**Rules.**
- Load the cinematic-ui skill before starting.
- Keep contrast accessible (WCAG AA) over the 3D background.
- Keep the reduced-motion and screen-reader paths working.
- Fonts must be free and self-hosted, and registered in the asset register.
- No new personal facts. Copy stays in `src/content/`.

---

## 8. Starting screen is not engaging → full redesign
**Status:** built, user replied "ok" 2026-11-18 (see `docs/reports/fix-01-08.md`). Not yet covered: sound gate, hook line, portrait and `--low` review. · **Area:** the first screen the visitor sees (loader, title and "start" prompt), `src/app/App.tsx`, `src/chapters/overlays.tsx`, `src/engine/journey/Journey.tsx` and its CSS, SC02 opening camera (`greybox/origin.tsx`). Confirm the exact files first. A quick search did not find a dedicated start-screen component.

**Problem.** The first impression is flat and forgettable. It does not set up the story, and nothing invites the visitor in.

**Requirement.** Replace it with a designed, cinematic opening that:
1. Shows a **real loading experience**: a progress readout (percent or mission countdown) while assets load. It reveals the scene instead of cutting to it.
2. Has a clear **title moment**: name, role and a one-line hook, with strong type and a live 3D backdrop. Not a static page.
3. Has one explicit **"Enter / Begin mission" action**. It unlocks audio and starts the journey.
4. Offers **sound on / sound off** at that gate. Sound only starts after the click, since browsers block autoplay.
5. Shows a short **scroll hint** (wheel, swipe and keys) that fades out after first input.
6. Ends in a **timed hand-off** of under 2 s into SC02: the copy blurs out, the camera eases in, then the first chapter text appears.
7. Has a **low-end path**: lighter backdrop on low tier and Android. Reduced-motion users get a calm, static version. It stays keyboard and screen-reader accessible.

**Reference ideas** (patterns to borrow, not to copy):
- Explicit "enter, with or without sound" gate, with a riser on enter and a hand-off under two seconds: [DKTON case study (Codrops)](https://tympanus.net/codrops/?p=125819).
- No button at all, an interaction as the gate (draw a circle, frost reveals the scene): [ZERO (Codrops)](https://tympanus.net/codrops/2026/07/17/zero-the-engineering-behind-a-defiant-interactive-narrative/). Worth considering as a "launch gesture", for example hold to ignite.
- Preloader that expands and fades to reveal the hero: [Stardance project log](https://stardance.hackclub.com/projects/26680).
- Awwwards preloader and intro element galleries to scan: [KVS Studio loader](https://www.awwwards.com/inspiration/loader-kvs-studio), [KVS hero](https://www.awwwards.com/inspiration/hero-section-kvs-studio), [Butter Studio 3D intro](https://www.awwwards.com/inspiration/3d-interactive-intro-butter-studio), [Skit Studio preloader](https://www.awwwards.com/inspiration/pre-loader-skit-studio).
- Space-specific: [In Space We Trust](https://www.designrush.com/best-design/in-space-we-trust) for the timeline and key navigation, and a [Three.js open-world space portfolio](https://discourse.threejs.org/t/an-open-world-space-experience-as-a-portfolio/74951).
- Performance note from the same research: stop the render loop when the hero is off screen, and use 2D fallbacks on weak devices.

**Approach.**
- First step: the user picks 2–3 references above (or other sites), then agree one wireframe before building.
- Load the cinematic-ui skill first. Typography follows item 7, so decide the fonts and colours before polishing this.
- Loading progress must come from the real asset loader. It must not be a fake timer.
- Audio: if there is none yet, a soft ambient bed and a launch riser would be new assets. Free assets only, and register them in `assets/ASSET_REGISTER.md`.
- The intro must not break the animation law. Story state stays a pure function of scroll progress, and the gate is a UI state before the journey starts.

**Open questions for the user.**
- Button gate ("Begin mission") or a gesture gate (hold to launch)?
- Do you want sound at all? If yes, ambient only, or music too?
- What is the hook line and the title text? (Copy must come from you. I will not invent personal facts.)
- Which of the reference sites do you like most?

**Done when.** The user approves the start sequence on desktop, portrait phone and `--low`. Load-to-interactive is not slower than today, and the main chunk does not grow noticeably.

---

## Cross-cutting checks for every fix
- `npm run verify`, `npm run build` and `npm run test:e2e` pass, and the real output is reported.
- Capture before and after frames with `scripts/capture-shots.ts`, including `--low` and `--portrait`.
- No increase in the main chunk size (already over target) or in GPU texture counts.
- Never modify `c:\projects\MainPortfolio\`.
- Update the matching report in `docs/reports/` and this file's status line.

## Still-open items from the handoff (not part of this list)
- A024 HelVela ship: needs the Sketchfab URL and author (CC BY credit).
- Stash image A029: it looks like a mockup. Confirm it or supply a real screenshot.
- The Vercel changes are uncommitted, and the git push needs `gh auth switch --user 23335a0504raju`.
