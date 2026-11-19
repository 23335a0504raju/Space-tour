# UI, UX and scroll experience audit

Date: 2026-11-19. Status: **audit only; no code changed; awaiting approval.**

Method: read the scroll, clock, Director, camera, overlay, header and styling code, the chapter registry and the recorded performance reports. The six images supplied are *reference* images (four spaceship interiors, Alex Antolino, Fundament Studio), not captures of this build, so every visual claim below comes from the code. I have not captured new frames yet. That is step 0 of the plan.

Legend: **[C]** confirmed in code · **[T]** likely, but needs a capture or a hands-on test to confirm.

---

## 1. Current implementation problems

### Scroll and motion

| # | Problem | Evidence |
|---|---|---|
| S1 | **[C] Two smoothing layers are stacked.** A wheel governor eases the page toward a target (10 % of the gap per frame, max 18 px/frame), then ScrollTrigger scrubs the story another 0.35 s behind the page. Measured in step 0: the first frame changes within 33 ms, but a short scroll takes about 0.5 s to finish and a notch moves only 32 px. | [usePacedWheel.ts:41](../../src/engine/scroll/usePacedWheel.ts#L41), [pacing.ts:9-19](../../src/engine/scroll/pacing.ts#L9-L19), [Journey.tsx:36](../../src/engine/journey/Journey.tsx#L36) |
| S2 | **[C] Wheel input is thrown away.** Each notch counts 55 % (max 90 px), and anything over 110 px of lead is discarded. A visitor who scrolls harder gets no extra response, so it feels sluggish rather than smooth. | [pacing.ts:9-17](../../src/engine/scroll/pacing.ts#L9-L17), [usePacedWheel.ts:25-26](../../src/engine/scroll/usePacedWheel.ts#L25-L26) |
| S3 | **[C] The journey is very long.** It is 33.5 screens. At 55 px per notch, Projects (SC08 starts at 37 %) needs about 200 wheel notches, and the whole story needs about 550. | [registry.ts](../../src/chapters/registry.ts) (screens per chapter) |
| S4 | **[C] The camera stops at every keyframe.** `sampleKeys` applies a smoothstep *per segment*, so camera velocity drops to zero at each key and then starts again. This is the main reason it feels like "a sequence of images rather than a journey". | [shots.ts:52](../../src/engine/camera/shots.ts#L52) |
| S5 | **[C] Time also freezes around rest points.** In a band 20 % wide, story time runs at 15 % speed. On top of S4, the scene looks static while you are still scrolling. | [resolver.ts:103](../../src/engine/scroll/resolver.ts#L103) |
| S6 | **[C] Cuts to black between chapters.** 11 of 13 boundaries fade to a solid colour (3.5 % on each side). Each chapter reads as a separate clip. | [overlayMath.ts:27-36](../../src/engine/director/overlayMath.ts#L27-L36), [registry.ts](../../src/chapters/registry.ts) (only SC03 and SC11-A are `seamlessFromPrevious`) |
| S7 | **[C] Scroll is locked until "Begin".** The start gate sets `overflow: hidden` until it is clicked. | [Journey.tsx:278-284](../../src/engine/journey/Journey.tsx#L278-L284) |
| S8 | **[C] No competing scroll systems.** There is one ScrollTrigger, one GSAP ticker driving R3F, no Lenis and no `setState` in the frame loop (`setActiveIndex` fires only on chapter change). The architecture is sound; it is over-governed, not broken. | [useScrollMaster.ts:64](../../src/engine/scroll/useScrollMaster.ts#L64), [clock.ts](../../src/engine/clock.ts), [Director.tsx:76](../../src/engine/director/Director.tsx#L76) |

### Text and interface

| # | Problem | Evidence |
|---|---|---|
| U1 | **[C] Fonts are placeholders.** Display, body and mono all use system stacks ("Typeface choice is pending"). | [tokens.css:5,17-19](../../src/styles/tokens.css#L5) |
| U2 | **[C] The header is too small.** The name is 16 px, the role 12 px, and the nav is 12 px mono uppercase. It reads as a HUD, not as site navigation. | [App.module.css:15-42](../../src/app/App.module.css#L15-L42) |
| U3 | **[C] The navigation is incomplete.** It has Projects, Resume (only if the URL fact is confirmed), Contact and Mission Brief. There is no About, Experience or Skills link, and no current-section highlight. | [App.tsx:42-59](../../src/app/App.tsx#L42-L59) |
| U4 | **[C] Internal codes are shown to visitors.** The progress label reads "SC02 · THE ROOM". The Flight Plan mixes chapter jumps with a quality setting. | [Journey.tsx:170,176-207](../../src/engine/journey/Journey.tsx#L170) |
| U5 | **[C] Every panel looks the same.** Each is a 72 % scrim with a 1 px gold left border, at most 30 rem wide, and fades as one block. Only the intro uses a display size; project titles max out at 36 px. | [overlays.module.css:8-22,78-91](../../src/chapters/overlays.module.css#L8-L22) |
| U6 | **[C] Text is visible only briefly.** A panel is fully opaque for ±7 % of its chapter and gone by ±12 %. SC05, SC10 and SC12 have no text at all: 5.5 screens, about 16 % of the journey. | [overlayMath.ts:14](../../src/engine/director/overlayMath.ts#L14), [registry.ts](../../src/chapters/registry.ts) |
| U7 | **[C] The opening has no introduction or actions.** The intro panel is a kicker plus name plus role. The summary arrives a chapter later (SC03, bottom). There are no "Explore projects" or "Resume" buttons in the hero. | [overlays.tsx:63-92](../../src/chapters/overlays.tsx#L63-L92) |

### 3D world

| # | Problem | Evidence |
|---|---|---|
| W1 | **[C] The room is pale grey.** Wall panels are #e6e9ee/#d3d8df under a #b4bac4 tint, with a dim environment (0.45). This is the "unfinished prototype" look. | [surfaces.ts:31-36,86](../../src/chapters/room/surfaces.ts#L31-L36), [origin.tsx:27](../../src/chapters/greybox/origin.tsx#L27) |
| W2 | **[C] The astronaut's actions already exist; framing hides them.** Typing, standing, chair push-back, walking and the door opening are already built in SC03. The camera spends SC02 looking out of the window, then pulls back. | [origin.tsx:39-45](../../src/chapters/greybox/origin.tsx#L39-L45), [departure.ts](../../src/chapters/greybox/departure.ts) |
| W3 | **[T] Little ambient motion in the room.** Only the typing loop and the screens animate. This needs a capture to judge. | [origin.tsx](../../src/chapters/greybox/origin.tsx) |

---

## 2. Root causes of the scrolling and animation problems

1. **Over-damping (S1, S2), corrected by step 0 measurements:** the delay before anything happens is short (the first frame changes within 33 ms). The problem is **weak response**: the governor turns a 100 px wheel notch into 32 px of travel and spreads a short scroll over about 0.5 s. The scrub on its own is fine (about 130 ms to 90 %). The governor was added to stop a single flick from flying through the whole story. It fixed that, but made normal scrolling feel sluggish.
2. **Stop-start camera (S4, S5):** zero velocity at every key, plus dwell freezes, gives "stills joined by moves".
3. **Hard chapter seams (S6):** fades to black break continuity.
4. **Length (S3):** 33.5 screens at the governed speed is a long time without new information.

**Not the cause:** a missing Lenis, competing scroll handlers, React re-renders or dropped frames. Recorded p95 frame times are about 17 ms (60 fps) on all built chapters. Those numbers are capped by the display, so they show the scene keeps up, not how much headroom is left. Android has not been measured.

---

## 3. UI design changes required

- Real typefaces (self-hosted, free, registered): a display face for headings, a readable body face, and the mono kept only for small labels.
- A real site header: name as a wordmark, then About · Experience · Projects · Skills · Resume · Contact, with the current section highlighted (driven by the existing `activeIndex`). Mission Brief becomes a secondary link. Quality settings move out of navigation into a small settings control.
- Visitor-facing chapter names ("Origin", "Experience", "Projects"), never "SC02".
- Three panel types instead of one (see §6).
- Staged reveals: kicker, then heading, then body, then actions, still driven by progress (see §6).

## 4. Typography and layout

| Role | Size (desktop → phone) | Notes |
|---|---|---|
| Hero name | clamp(3rem, 2rem + 4.5vw, 6rem) | display face, tight tracking |
| Section heading | clamp(2.25rem, 1.6rem + 2.4vw, 4rem) | display face (40 to 64 px on desktop) |
| Lead | clamp(1.125rem, 1rem + 0.6vw, 1.5rem) | body face |
| Body | 1rem to 1.125rem, line-height 1.6, max 62ch | body face |
| Label / kicker | 0.75 to 0.8125rem mono, caps tracking | kept from today |

Layout: a 12-column grid with content on columns 1–6 or 7–12 so the 3D subject owns the other half. Desktop gutters stay as they are. On phones, panels become a bottom sheet capped at 55 svh, which matches today's rule.

## 5. Proposed opening (SC02)

The start gate becomes the hero instead of a lock:

```
[wordmark]        About  Experience  Projects  Skills  Resume  Contact

MISSION · ORIGIN
Raju Chowdavada                      ← identity.name (Q1 still open)
Software Engineer                    ← identity.role (Q1 still open)
Software Engineer specializing in scalable web applications, APIs, and
full-stack systems using Java, Python, React.js, and Node.js.   ← identity.summary
[ Explore projects ]  [ Resume ]

Scroll to begin ↓
```

- Scroll works immediately; no Begin lock (fixes S7). The asset preload continues in the background, and the loader shrinks to a small status line.
- 3D: the camera opens *on the astronaut typing* (with the window and planet behind), not on the window alone. The hero text holds through the first screen and then staggers out. SC03 continues straight on: stand, turn, walk, door.
- A hook line such as "Building beyond the ordinary" is copy you need to approve. I will not add it without your approval.

## 6. Proposed chapter panel designs

| Type | Use | Look |
|---|---|---|
| **Editorial** (no card) | Intro, summary, strengths, closing | Large heading and lead set directly over the scene, with a soft radial vignette behind the text instead of a box |
| **Side panel** | Experience, education, stack, certifications | Wider (36 to 40 rem), 4 to 6 px radius, gradient scrim, hairline border, `backdrop-filter: blur(8px)` only on this type and only on Balanced tier |
| **Showcase** | Flagship projects | See §7 |

Motion: the Director writes one value per panel (`--o`, from 0 to 1), as it writes opacity today. CSS derives the staged offsets for kicker, heading, body and actions from it. This is still a pure function of progress, uses one clock, reverses exactly and needs no `setState`. Widen the readable band from ±7 % to about ±15 %, and give SC05, SC10 and SC12 a short caption so no stretch of the journey is empty.

## 7. Proposed project presentation

There are 3 flagships in SC08: SmartWay Traffic (diorama), DocumentDB and Stash (architecture). Each showcase panel shows:

`PROJECT 01 / 03` · name (section-heading size) · one-line summary · role · up to 3 "What I built" bullets from `projects.ts` · stack chips · Live / Code buttons · preview image where one exists · "Open dossier" (the existing Project Bay).

The 5 supporting projects stay as a compact list (SC07) with live and code links. Everything comes from `src/content/projects.ts`; nothing new is written.

## 8. Proposed navigation and progress

- **Header:** as in §3, transparent over dark scenes and more opaque over the bright anime skies (already handled with a solid gradient; tune it).
- **Progress:** keep the thin gold bar, and add 6 section ticks (Origin, Experience, Strengths, Projects, Stack, Beyond, Contact) that are clickable and show the current one. These replace the "SC02 · THE ROOM" label.
- **Previous / Next:** ←/→ already step between rest points ([Journey.tsx:333](../../src/engine/journey/Journey.tsx#L333)). Add visible buttons for them next to the progress bar.
- **Direct jumps:** each header item calls the existing `navigate(id)` with its fade jump. Resume and Contact never require scrolling.

## 9. Performance risks

| Risk | Mitigation |
|---|---|
| `backdrop-filter` over a full-screen WebGL canvas is costly on the 780M and on Android | Use it on side panels only, Balanced tier only, small area; Low tier gets a flat scrim |
| Web fonts delay first paint and shift layout | 2 families, woff2, `font-display: swap`, preload the display face only |
| The preload downloads *every* journey asset before any chapter mounts (45 s give-up) | **[T]** Measure total transfer. If it is large, gate only SC02–SC04 and stream the rest (warm window = 1 already exists) |
| A darker, metal room needs more lighting cost | Change the canvas textures and material values; no new lights or post passes |
| No headroom data (display-capped) and no Android data | Step 0 below |

## 10. Prioritised implementation plan

Each step ends with `npm run verify`, `npm run build`, frame captures and a short report, then stops for your approval.

| # | Work | Files | Risk |
|---|---|---|---|
| 0 | **Baseline captures.** Frames for SC02–SC04 and SC08 on desktop, Low and portrait; perf on both tiers; a short wheel-to-picture lag measurement | `scripts/capture-shots.ts` (no app change) | none |
| 1 | **Scroll feel.** Remove the governor's lead cap and speed cap (or remove the governor) and keep one smoothing layer (scrub about 0.3–0.5 s). Shorten the track from 33.5 to about 22–24 screens. Narrow the dwell. Test "a single flick doesn't skip a chapter" by hand | `pacing.ts`, `usePacedWheel.ts`, `Journey.tsx`, `registry.ts`, `resolver.ts` | medium (re-tune) |
| 2 | **Continuous camera.** Catmull–Rom through the keys (continuous velocity), eased only at chapter ends. Existing departure tests keep the camera clear of the walk path | `shots.ts` (+ tests) | low |
| 3 | **Opening and typography.** Fonts, type scale, hero (§5), remove the Begin lock | `tokens.css`, `StartGate.*`, `overlays.tsx`, `App.*` | medium |
| 4 | **Panels and navigation.** 3 panel types, staged `--o` reveal, header nav, section ticks, Previous/Next | `overlays.*`, `Director.tsx`, `App.*`, `Journey.*` | medium |
| 5 | **Seams and atmosphere.** Replace dips with match cuts where the scenes allow it. Darker metal room with warm and cool key lights. Opening shot on the astronaut | `overlayMath.ts`, `surfaces.ts`, `origin.tsx`, `RoomSet.tsx` | medium |
| 6 | **Project showcase** (§7) | `overlays.tsx`, `ProjectBay.*` | low |
| 7 | Anime worlds (needs your item 6 answers), then Android and mobile polish | — | — |

---

## Step 0 baseline (measured 2026-11-19)

Production build (`npm run build` passes), `npm run preview`, headless Chrome on the Radeon 780M, 1440×900 unless stated otherwise. Frames are in `spike-results/shots/{desktop,portrait}/`. The measurement scripts live in the session scratchpad, not in the repo.

### Scroll response (Balanced, parked at the SC02 title)

| Input | Page moved | First frame changes | Story at 90 % |
|---|---|---|---|
| 1 wheel notch (100 px) | **32 px** | 33 ms | 183 ms |
| 5 notches over 250 ms (500 px) | 226 px | 32 ms | 533 ms |
| Hard flick, 30 notches (3000 px) | 1100 px = **1.2 screens** | 33 ms | about 5 s (includes Playwright input-dispatch time, so the duration is approximate; the distance is reliable) |
| Page moved directly by 300 px (scrub only, no governor) | — | 29 ms | **129 ms** |
| **Wheel notches from the start to Projects (SC08), at a brisk 10/s** | | **350 notches, 58 s** | |

Conclusion: the governor (`pacing.ts`) is the cause. It keeps about 30 % of wheel input and caps speed. The scrub is fine.

### Frame time and GPU counters

| Frame | Tier | p95 (60 Hz capped) | Draw calls | Triangles | Live textures |
|---|---|---|---|---|---|
| SC02 t 0 / 0.3 / 0.6 / 0.95 | Balanced | 17.1–17.2 ms | 142 / 119 / **168** / 150 | 206–225k | 51 |
| SC03 t 0.1 / 0.35 / 0.6 / 0.9 | Balanced | 17.0–17.3 ms | 149 / **157** / **171** / 106 | 135–227k | 73 |
| SC04 t 0.35 / 0.7 | Balanced | 17.1–17.2 ms | 105 / 84 | 127–136k | 62 |
| SC08 t 0.25 / 0.5 | Balanced | 17.2–17.4 ms | 28 / 27 | 55–69k | 47 |
| SC02 0.6 · SC03 0.35 · SC08 0.25 | Low | 17.1–17.2 ms | 114 · 102 · 7 | 50–150k | 20–40 |
| same | Portrait 412×915 @2.6× | 16.8–17.2 ms (one 184 ms spike in SC08) | 157 · 154 · 26 | 45–217k | 43–72 |

- **SC02 and SC03 exceed the ≤150 draw-call Balanced budget** (peak 171) and are about 100 draw calls even on Low. This needs to be fixed before the room gets richer materials (plan step 5).
- **Headroom (vsync and frame-rate limit removed):** about 145–176 fps in every chapter on both tiers, with a median frame interval of 1.3–4.2 ms (the room is the heaviest at 2.8–4.2 ms). The uncapped p95 is about 18 ms everywhere, even in the lightest scenes, which points to a headless compositor artefact rather than scene cost. Scroll smoothness is **not** limited by rendering on this laptop.
- Android: still not measured.

### Load

- **8.4 MB** transferred before the journey starts: GLB 4.3 MB, HDR 1.5 MB, KTX2 1.4 MB, JS 0.6 MB, Basis WASM 0.5 MB. That took 1.7 s from localhost. On a 10 Mbit/s phone connection it would be about 7 s behind the start gate. Supports the "gate only the first chapters" item in §9.
- The `Journey` JS chunk is 1.1 MB (359 kB gzipped); the build warns about it.

### New problems seen in the frames

| # | Problem | Frame |
|---|---|---|
| F1 | **[C] Portrait SC08 shows no 3D subject.** The upper half of the screen is black and the panel fills the lower half. | `portrait/sc08-jupiter-0.25.png` |
| F2 | **[C] White astronaut on a white desk against pale walls,** so the main character has no contrast. | `desktop/sc02-room-0.6.png` |
| F3 | **[C] No Resume link in the header** (the resume-URL fact is not confirmed, so it is hidden). | all |
| F4 | **[C] On phones, the header takes about 12 % of the screen** (name, role and nav on 3 lines). | `portrait/sc02-room-0.6.png` |
| F5 | **[C] The SC08 project panel covers Jupiter;** the satellite on the left is unlit grey on black. | `desktop/sc08-jupiter-0.25.png` |
| F6 | **[C] The progress bar runs underneath the Flight Plan button.** | `desktop/sc08-jupiter-0.25.png` |
| F7 | **[C] SC02 opens looking at the window frame and the back of the astronaut's helmet;** the ship is small and partly behind the gantry. | `desktop/sc02-room-0.png` |

---

## Step 1 result: scroll feel (desktop), 2026-11-19

Approved rules: a flick moves about one chapter, never more; scrolling works without pressing Begin.

### Changes

| File | Change |
|---|---|
| [pacing.ts](../../src/engine/scroll/pacing.ts) | A wheel notch counts in full (it was 55 %). The idle drop that threw away the rest of each notch is gone. Distances are now fractions of the viewport. A new **burst budget** limits a fling: travel counts only while the input outruns the page (lead saturated), and after 1.3 screens the rest of that continuous stream is ignored until a 150 ms pause. A steady wheel or a slow trackpad drag never saturates the lead, so it is never cut. |
| [usePacedWheel.ts](../../src/engine/scroll/usePacedWheel.ts) | Wires up the budget. |
| [registry.ts](../../src/chapters/registry.ts) | Track shortened from 33.5 to **22.6 screens**. Proportions kept: Experience at 12 %, Projects at 40 %, Contact at 89 %. |
| [resolver.ts](../../src/engine/scroll/resolver.ts) | Dwell band changed from 0.2 to 0.16 wide, and time near a rest point runs at 25 % (it was 15 %). |
| [StartGate.tsx](../../src/ui/StartGate.tsx), [store.ts](../../src/engine/store.ts), [Journey.tsx](../../src/engine/journey/Journey.tsx) | Scroll is locked only while assets load. From the title on, the first wheel, swipe or scroll key enters the journey and the visitor's scroll drives it from the live shot (no camera hand-off and no hint). Begin still plays the hand-off, and any input during it cancels it. A jump before entering skips it. |

### Measured (same method as step 0)

| | Step 0 | Step 1 |
|---|---|---|
| 1 notch (100 px) moves the page | 32 px | **98 px** (90 % in 183 ms) |
| 5 notches (500 px) | 226 px | **491 px** |
| Wheel notches to Projects at 10/s | 350 (58 s) | **80 (14 s)** |
| Trackpad flick with 1 s of momentum (3.4 screens of input) | — | **1.9 screens** |
| Very hard fling with 2 s of momentum (9.4 screens of input) | — | **1.8 screens** |
| Scroll locked on the title screen | yes | **no** (a wheel on the title entered and scrolled 498 px; no page errors) |

Checks: `npm run verify` passes (102 tests, including 5 new pacing tests that simulate the hook's wiring). `npm run build` passes. `npx playwright test` passes 24/24 (reverse panels, rest points, jumps, Project Bay, axe).

Not done in this step, by agreement: mobile and touch tuning. Still open for later steps: the camera stopping at keyframes (step 2), and overlay text being readable for only ±7 % of a chapter, which is now fewer pixels because chapters are shorter (step 4).

---

## Step 2 result: continuous camera, 2026-11-19

### Change

[shots.ts](../../src/engine/camera/shots.ts) `sampleKeys`, which every chapter's camera goes through. No chapter files changed. The per-segment smoothstep (zero velocity at every key) is replaced by a **monotone cubic spline (PCHIP)** per channel (position, aim, FOV), with uneven key spacing:

- Velocity is continuous through interior keys, so the camera flows instead of stopping.
- Monotone: no channel overshoots its neighbouring keys, so a camera can't swing through a wall or a subject. The departure clearance tests still pass.
- The camera still eases into and out of each chapter, and it still settles where a channel turns back or where two keys hold the same value (deliberate holds keep working).
- Still a pure function of t: reverse scrolling and jumps give identical frames. It allocates nothing per frame.

### Measured: mid-chapter camera stops (speed below 15 % of the chapter median, ignoring the first and last 3 %)

| Chapter | Before | After |
|---|---|---|
| SC03 Departure | 1 | **0** |
| SC06 Sunrise | 2 | 1 (at the Strengths rest point, where the aim swings back) |
| SC08 Projects | 3 | **0** |
| SC09 Saturn | 2 | **0** |
| SC13 Homecoming | 2 | 1 (the deliberate hold behind the final contact panel) |
| SC07, SC10, SC12 | 0 | 0 |
| **Total** | **10** | **2**, both intentional |

(SC02, SC04 and SC11 keep their keys inside `.tsx` files that node can't load, so the script couldn't profile them. They use the same function.)

Checks: `npm run verify` passes (105 tests, including 4 new camera tests: flows through keys, no velocity jump, eases at the ends, no overshoot). `npm run build` passes. `npx playwright test` passes 24/24. I reviewed frames between keys in SC03 and SC08.

### Found while checking (not caused by this step)

- **J1: a long jump can show a black frame for more than 1.5 s.** Jumping straight to SC08 (as the header's Projects link does) rendered black on the first capture with *both* the old and new cameras; the chapter was not mounted yet when the jump fade lifted. To fix in step 4 (navigation): hold the jump fade until the target chapter has rendered a frame.

---

## Step 3 result: opening and typography (desktop), 2026-11-19

Decisions by Raju (closes Q1): role "Full-Stack Software Engineer & AI Builder", name "Raju Chowdavada", hook line "Building beyond the ordinary", typefaces Space Grotesk + Inter.

### Changes

| Area | Change |
|---|---|
| Content | `identity.name` and `identity.role` are now `confirmed`. New `identity.tagline` (confirmed copy). Q1 marked resolved in `CREATIVE_DECISIONS.md`. Content audit: conflicts 4 → 2. |
| Fonts | `@fontsource-variable/space-grotesk` and `@fontsource-variable/inter` (5.3.0, OFL, self-hosted, registered as A034/A035). Labels use Inter in spaced capitals, so there are two families. The browser loads only the latin subsets (22 KB + 48 KB). |
| Tokens | New type scale: body 17 px; lead up to 24 px; section heading 36–64 px (`--text-h2`); hero 48–96 px (`--text-display`); `--measure`. |
| Header | Name 20 px in the display face, role 13 px, nav 13 px Inter caps (was 12 px monospace). Its structure (sections, active state) is step 4. |
| Start gate | Kicker "Mission 001 · Origin" (was "SC01 · Signal"). The hook line is the headline (decode effect), then name, role and the resume summary. The dock has "Scroll to begin ↓", **Explore projects** (jumps to SC08) and **Begin mission**. |
| SC02 introduction | First use of the **editorial** panel type: name as a large heading, role, summary, then **Explore projects** and Mission Brief. Set straight over the scene on a soft vignette with no box. Readable band widened to ±0.25 of the chapter (`band` option on overlays). The summary is no longer repeated alone in SC03. |

**Resume button: not added.** `contact.resumeUrl` is still `missing` (two different resume PDFs exist, Q5). It will appear in the header and the opening as soon as the current PDF is supplied.

Checks: `npm run verify` passes (105 tests). `npm run build` passes. `npx playwright test` passes 24/24, including axe with zero violations on `/`, `/?gate=off` and `/brief/`. Both fonts are confirmed loaded in the built page.

Known, for later steps: the gate headline sits over the ship in the window and the SC02 summary partly over the helmet (camera framing, step 5). Phone layout is deferred.

### Decisions I need from you

1. **Name and role (Q1):** "Raju Chowdavada" and which role: "Software Engineer", or the site's "Full-Stack Software Engineer & AI Builder"?
2. **Hook line** for the hero: approve one, or none.
3. **Fonts:** a preference, or should I propose two free pairings?
4. **Scroll trade-off:** step 1 makes a hard flick travel further again. Is "a flick may move about one chapter, never more" the right rule?
5. **Removing the Begin lock** (scroll works immediately): OK?
