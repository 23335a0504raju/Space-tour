# TECHNICAL BLUEPRINT

> Architecture for the cinematic portfolio. Batch 2 planning only: **no source code exists yet**. The stack rationale is in `STACK_DECISIONS.md`.
> The **anime-inspired universe** is a confirmed requirement. This blueprint reserves architectural space for it (art-style switching and pluggable chapters) but does not define its story, worlds or visuals; those belong to Batch 3.

---

## 1. Architecture in one picture

```
┌──────────────────────────── Browser window ────────────────────────────┐
│  [Persistent UI layer]  name · Resume · Mission Brief · Menu · progress │  ← DOM, fixed
│  [Overlay layer]        chapter text, Project Bay, captions             │  ← DOM, fixed
│  [Canvas layer]         one WebGL canvas, one renderer                  │  ← fixed, full-screen
│  [Scroll track]         invisible tall element (sum of chapter lengths) │  ← the only thing that scrolls
└─────────────────────────────────────────────────────────────────────────┘

scroll position ─► ScrollTrigger ─► MASTER PROGRESS (0..1) ─► Director
                                                               │
              ┌────────────────────────────────────────────────┼─────────────────┐
              ▼                       ▼                        ▼                 ▼
       Chapter resolver        Chapter timelines        Camera director    Overlay timeline
   (which chapter, local t)  (GSAP, paused, seeked)   (shots → camera)   (DOM text, seeked)
              │                       │                        │                 │
              ▼                       ▼                        ▼                 ▼
   Zustand: activeChapter    Rig state (plain mutable object: camera, astronaut, ship, lights, fx)
   (discrete, rarely changes)                     │
                                                  ▼
                                    R3F render (one clock tick)
```

**Key idea:** the whole experience is a **pure function of one number**, the master progress. If you seek to any value from any direction, the result is identical. That is how reverse scrolling and chapter jumps "restore" state: nothing is restored; it is simply recomputed.

---

## 2. Application-level architecture

### 2.1 Two entry pages (one codebase)
| Entry | Purpose | Tech |
|---|---|---|
| `/` **Journey** | The cinematic experience | Vite SPA entry, R3F canvas, lazy-loaded chapters |
| `/brief/` **Mission Brief** | Complete content without WebGL | Separate Vite entry, **prerendered to static HTML at build time** (React static rendering), works with JavaScript disabled, no Three.js in its bundle |

Both read from the **same content module**, so the Brief can never drift out of date. Resume PDF, sitemap, robots and social metadata are static files.

### 2.2 Proposed folder layout (planning only; nothing created yet)
```
src/
  content/           single source of truth: typed personal content (verified only)
  app/               journey shell: boot, capability detection, error boundaries, persistent UI
  engine/
    scroll/          scroll track, ScrollTrigger master, chapter resolver, jump-to-chapter
    director/        master timeline assembly, rig state, clock integration
    camera/          camera director, shot types, framing variants
    characters/      astronaut controller (mixer driven by timeline time)
    vehicles/        ship controller (spline transforms, engine fx params)
    assets/          manifest, preload policy, cache, disposal
    quality/         tier detection, runtime adaptation, settings
    styles/          art-style profiles (realistic, anime-inspired, …) and material swaps
  chapters/
    _registry.ts     ordered list of chapter modules
    origin-room/     one folder per chapter (see contract §3)
    …                (anime-universe chapters plug in here in Batch 3)
  overlays/          shared overlay components (title cards, mission log, spectrum, Project Bay)
  shaders/           shared GLSL (atmosphere, sun, rings, lensing, wireframe-to-solid, toon)
  brief/             Mission Brief entry and components
public/
  assets/<chapter>/  optimised .glb / .ktx2 only (no source art)
  resume.pdf
```

### 2.3 Boot sequence
1. HTML shell renders instantly: name, role and links to **Resume** and **Mission Brief**. Visitors can leave or skip before any 3D loads.
2. **Capability check:** WebGL2 available? `prefers-reduced-motion`? Save-Data? Device memory? This decides the initial quality tier, or a redirect suggestion to the Brief.
3. Load the **core bundle** (React, three, R3F, GSAP) plus the **first chapter's assets**. Show the countdown screen with *real* progress.
4. Build the master timeline from the registry, mount the first chapter, start the clock.
5. In the background, prefetch the next chapter's assets.

---

## 3. Scene & chapter architecture

### 3.1 The chapter contract
Every chapter is a self-contained module that the engine treats identically. **Adding a destination = adding one folder + one registry line.**

| Part | Responsibility |
|---|---|
| **meta** | `id`, chapter title, nav label, act, art-style profile (`realistic` / `anime` / …), scroll length per aspect class, rest points (local t values), whether it appears in navigation |
| **content keys** | which entries of the content module it displays (never hard-coded text) |
| **asset manifest** | list of GLB/KTX2/textures with per-tier variants and estimated sizes |
| **Scene component** | the 3D content for this chapter, in its own local coordinate space (own origin) |
| **timeline factory** | builds a *paused*, *deterministic* GSAP timeline of length 1, animating only the rig state and this chapter's own refs |
| **shots** | camera shots as functions of local t, with portrait / landscape / ultrawide variants |
| **overlay component** | DOM text and interactive elements for this chapter, animated by the overlay timeline |
| **fallback** | a still image (or poster frame) and text used by the Low tier, reduced motion, or after an asset failure |
| **brief mapping** | where its content appears in Mission Brief |

### 3.2 Chapter lifecycle (by master progress)
| State | When | What happens |
|---|---|---|
| `dormant` | far away | Nothing loaded |
| `prefetching` | next/previous within N chapters | Asset bytes fetched (HTTP cache) but not decoded |
| `warm` | adjacent | Assets decoded, GPU-uploaded, shaders precompiled; scene mounted with `visible=false` |
| `active` | playhead inside its range | Visible and rendered; its timeline is seeked every tick |
| `cooling` | left behind by more than N chapters | Unmounted, GPU resources disposed, bytes kept in HTTP cache |

N is tier-dependent (High: 2, Balanced: 1, Low: 1). A **transition region** at each chapter boundary may keep two chapters active for a cut or crossfade.

### 3.3 Coordinate spaces
Each chapter has its own origin. Space distances are **never** modelled in one global coordinate system, which avoids floating-point jitter at planetary scales. Continuity between chapters comes from **cuts, crossfades, match-cuts and transition chapters**. The solar system feels continuous because of direction, lighting and the ship, not because of shared coordinates.

### 3.4 Extensibility
- Destinations are data-driven by the registry order. Reordering (e.g. moving the Sun) is a registry edit plus a re-check of transitions.
- **Art-style profiles** (`engine/styles`) let a chapter declare `realistic` or `anime`. The profile selects tone mapping, post-processing set, lighting rig template, outline pass and material variants (e.g. a toon material for the astronaut). This is the only anime-specific architectural decision in Batch 2.

---

## 4. Scroll progress & timeline synchronisation

### 4.1 Mapping scroll to time
- **Scroll track:** total height = Σ(chapter scroll length) for the current aspect class, computed in px.
- **Master progress** p ∈ [0,1] comes from one ScrollTrigger (`scrub` with a small numeric smoothing, *or* `scrub: true` with Lenis, never both).
- **Chapter resolver:** p → `(chapterIndex, localT)` using cumulative lengths. Rest points become **dwell zones**: the local timeline is re-mapped so a band of scroll distance maps to a nearly flat band of time. Text stays readable while the visitor keeps scrolling, and no scroll lock is ever needed.

### 4.2 The master timeline
- Each chapter's timeline (length 1) is placed in a master timeline at its range.
- One GSAP timeline per *layer* is acceptable (3D rig layer, overlay layer), but **all are seeked from the same p in the same tick**.
- **No `onEnter` / `onLeave` side effects that change visuals.** Callbacks may only trigger loading, analytics or ARIA announcements. Any visual state must come from the timeline, or reversing would break.

### 4.3 Story time vs ambient time
| Kind | Driven by | Examples | Reversible? |
|---|---|---|---|
| **Story time** | master progress | camera moves, astronaut walk, ship flight, text in/out, light changes | Exactly |
| **Ambient time** | wall clock (delta) | Sun surface churn, cloud drift, monitor flicker, breathing idle, star twinkle | Not needed (it's ambience) |

This split is what makes the experience feel alive while parked at a rest point, without breaking determinism.

### 4.4 Reverse scrolling
Because every story property is a function of p, scrolling backwards replays the same frames in reverse:
- The astronaut walks backwards (clip time decreases).
- The ship returns along its spline.
- Text fades back in.

**Rule:** nothing in story time may depend on previous frames: no accumulated velocities, no "if already played, skip", no random values (use seeded randomness).

**Test:** `state(seek a → b) === state(seek b)` for any a, b (path-independence; see `DEVELOPMENT_WORKFLOW.md`).

### 4.5 Chapter jumps (navigation)
1. Fade the canvas to black over about 300 ms (DOM overlay).
2. Ensure the target chapter is `warm` (show "acquiring signal" if it's still loading).
3. Set the scroll position instantly and **force the playhead to the target p**, bypassing the scrub smoothing, so intermediate chapters are never rendered or loaded.
4. Recompute chapter states, then fade in. Reduced-motion users get an instant cut.

### 4.6 Fast scrolling
A fast flick can push the playhead into a chapter that isn't `warm` yet. The policy, in order:
1. The prefetch window is sized by tier.
2. If the target still isn't ready, render the chapter's **fallback still** with an "acquiring signal" treatment until assets are ready, then crossfade.
3. Never block scrolling.

---

## 5. Camera management
- **One camera**, owned by the **Camera Director**. Chapters never create cameras; they provide **shots**.
- **Shot types:**
  - *spline dolly*: position curve + look-at curve.
  - *orbit*: around a target at radius and angle.
  - *attached*: parented to the ship or astronaut with an offset (cockpit, over-the-shoulder).
  - *locked*: static, with optional ambient handheld noise.
- **Shot parameters per local t:** position, target, FOV, roll, focus distance (for DOF on High), shake amplitude.
- **Blending:** transition regions blend shot A → B with easing, or hard-cut on a specified frame.
- **Framing variants:** each shot has `portrait`, `landscape` and `ultrawide` versions (different paths or FOV, not just a narrower view). The variant is chosen by aspect class at load and on resize.
- **Dev-only free camera** (drei camera controls) toggled by a debug key and stripped from production.
- Camera shake and handheld noise are seeded and story-time-based where they matter for reproducibility, ambient otherwise.

## 6. Astronaut animation management
- **One astronaut asset** loaded once and kept warm across the chapters that use it (room, cockpit, interior beats, final scene, anime universe).
- **The mixer is never advanced by wall-clock time for story actions.** The timeline sets each action's time and weight, then calls a zero-delta mixer update. Clip blending (e.g. sit → stand → walk) is a weight cross-fade *expressed in local t*, so it reverses cleanly.
- **Walking without foot sliding:** the walk clip is in-place (no root motion). The astronaut's position comes from a path curve. The walk clip time is derived from **distance travelled ÷ stride length**, so feet plant correctly at any scroll speed in both directions.
- **Ambient layer:** a subtle breathing/idle additive clip may run on wall-clock time only while at a rest point.
- **Interactions not in the motion library** (helmet, door, beacon) are covered by **camera cuts plus object animation**, per Batch 1 R3.
- **Art-style switch:** in anime-styled chapters the same skeleton uses an alternate material set (toon shading + outline). No second rig.

## 7. Spaceship animation
- A rigid model with sub-parts (hatch, landing legs, RCS nozzles, engine bells) as named nodes.
- **Transform:** position along a chapter spline + orientation (tangent-aligned with authored roll/heading keys) driven by local t.
- **Effects as parameters, not simulations:** engine intensity, plume length, RCS puff triggers (seeded, story-time), heat-shield glow. Shaders read these uniforms from the rig state.
- **Interior and exterior:** the cockpit is a separate asset, mounted only in chapters that show it.

## 8. Scene transitions & loading
| Transition | Technique |
|---|---|
| Hard cut | Switch active chapter at an exact local t (good for action cuts) |
| Crossfade / dip-to-black / white-out | Full-screen DOM or shader overlay animated in the overlay timeline |
| Match cut (door → hatch) | Both chapters active in the transition region; framing authored so silhouettes align; cut on a specified frame |
| Effect transition (wormhole, art-style shift) | A dedicated transition chapter owning a screen-space shader; can blend two art-style profiles |

**Loading:** see the lifecycle in §3.2.
- Shaders are precompiled during `warm` (renderer compile on the hidden scene) to avoid hitching on entry.
- GPU uploads are spread across frames where possible.

## 9. HTML content overlays
- Overlays are **real DOM**, never text baked into textures. This keeps text crisp, selectable, translatable and screen-reader accessible.
- **Positioning:**
  - Most text is **screen-anchored** (editorial layout).
  - A few labels are **world-anchored** (projected 3D positions written to CSS transforms each frame by direct DOM mutation, not React state). Examples: outpost markers, Saturn ring bands, asteroid beacons.
- Text animation is part of the scrubbed overlay timeline, so it reverses like everything else.
- **Diegetic screens** (cockpit Mission Profile, Flight Plan, spectrometer) are rendered to a canvas texture *from the same content data*, with the DOM equivalent present for assistive tech.
- **Readability:** adaptive scrims (gradient behind text) authored per rest point, verified for contrast in tests.

## 10. Interactive elements
| Element | Behaviour |
|---|---|
| Hover/tap captions (room objects, outposts, beacons) | Raycast on a small set of *hit proxies* (simple invisible meshes), not full models |
| **Project Bay** | Opening it records the current p and pauses scroll-driven updates (scroll track inert). It shows a focused DOM panel plus an optional diorama scene rendered **in the same canvas** (no second WebGL context). Closing it (button, Esc, or scrolling) restores the exact p. |
| Chapter menu / Flight Plan | Chapter jump procedure (§4.5) |
| Keyboard | ←/→ or PageUp/PageDown jump between rest points; Esc closes; Tab through overlay controls |
| Audio toggle (optional) | Off by default; ambience bed plus diegetic cues tied to story time |

## 11. Responsive behaviour
- **Aspect classes:** portrait (< 0.8), landscape (0.8–2.0), ultrawide (> 2.0). Each selects shot variants and scroll lengths.
- **Size classes** for typography and overlay layout (fluid type with clamp).
- **Quality tier** is independent of size: a large low-power laptop can be Low; a flagship phone can be Balanced.
- **Orientation change** triggers a recompute of scroll lengths and track height, with p preserved.

## 12. Mission Brief mode
- A static, prerendered page: complete content (identity, education, experience, projects with links and images, stack, learning, future direction, contact, resume).
- **No WebGL, no Three.js, works without JavaScript**, fast (< 100 KB of JS, if any).
- Reachable from every state of the journey and offered automatically when WebGL fails or the device is constrained.
- Each chapter's anchor in the Brief mirrors the journey's chapter IDs, so "Open this in Brief" deep-links to the same content.

## 13. Error handling & fallbacks
| Failure | Response |
|---|---|
| No WebGL2 / blacklisted GPU | Show the Brief with a short note: "the cinematic version needs a WebGL2-capable browser" |
| `webglcontextlost` | Pause; show "signal lost"; on restore, re-upload assets of the active and warm chapters; if restore fails, offer the Brief |
| Asset fetch/decode failure | Retry once with backoff, then show the chapter's fallback still + text; log once to the console (no external telemetry unless you approve it) |
| Chapter render error | A per-chapter React error boundary swaps in the fallback; the rest of the journey continues |
| Sustained low FPS | `PerformanceMonitor` steps the tier down (DPR → post-processing → shadows → texture tier); if it is still failing, offer the Brief |
| Reduced motion | Static photo-story (stills + crossfades) or the Brief, at the visitor's choice |
| Slow network / Save-Data | Start at the Low tier and offer the Brief up front |

## 14. React re-render discipline (summary)
- React re-renders only on **discrete** events: chapter state changes, tier changes, overlay open/close, resize class change.
- Per-frame values live in the **rig state** (a plain object) and refs.
- Zustand selectors subscribe narrowly; `useFrame` reads via `getState()`.
- There must be **no state updates in `useFrame`, in scroll handlers, or in pointer-move handlers.**
- Verified with the React DevTools profiler during chapter acceptance: zero commits while scrolling within a chapter.

## 15. Integration approach (how chapters come together)
1. **Engine first** (scroll track, resolver, director, camera, asset lifecycle, quality, overlays), proven with a placeholder "grey-box" chapter.
2. **Vertical slice:** Origin room → door/hatch match cut → cockpit. This proves character, baked lighting, match cut and overlay timing.
3. Then chapters in story order, each passing its acceptance gate before the next begins (`DEVELOPMENT_WORKFLOW.md`).
4. The Mission Brief is built in parallel from the content module, and is never left for the end.
