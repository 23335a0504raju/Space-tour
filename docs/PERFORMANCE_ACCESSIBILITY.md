# PERFORMANCE & ACCESSIBILITY STRATEGY

> No numbers here are promises. They are **targets** that become pass/fail gates only after the Batch 3 baseline spike (S4) measures real devices. Each target names its measurement method.

---

## 1. Device classes

| Class | Example | Default tier |
|---|---|---|
| Desktop with discrete GPU | Gaming / workstation PC | High |
| Mid-range laptop (integrated GPU) | Typical student or office laptop, Intel/AMD iGPU, Apple M-series base | Balanced (M-series often High) |
| Recent iPhone / flagship Android | Last 3 generations | Balanced |
| Mid/low Android, older iPhone | 3–4 GB RAM | Low |
| Very constrained / no WebGL2 / Save-Data | — | Mission Brief suggested |

**Reference devices needed from you:** the actual laptop and phone(s) you can test on. Targets are validated on *those*, plus Chrome DevTools throttling as a secondary signal.

## 2. Quality tiers

| Setting | High | Balanced | Low |
|---|---|---|---|
| Device pixel ratio cap | 2.0 | 1.5 | 1.0 |
| Texture max size (KTX2) | 4K planets / 2K props | 2K / 1K | 1K / 512 |
| Real-time shadows | 1 shadow-casting light, soft, small map | 1 light, hard, small map | None (baked only) |
| Post-processing | Tone mapping + bloom + subtle DOF (selected shots) + vignette + film grain | Tone mapping + bloom + vignette | Tone mapping only (vignette in CSS) |
| Anti-aliasing | MSAA (or SMAA if post-processing is on) | SMAA / FXAA | None (DPR 1 + FXAA if needed) |
| Atmosphere / Sun shaders | Full (multi-octave noise) | Reduced octaves | Simplified / pre-rendered texture |
| Particles (ring dust, cloud layers, debris) | Full counts | ~50% | ~20% or off |
| Asteroid instances | ~2000 | ~800 | ~250 |
| Sky | Panorama cubemap or full procedural | Procedural, fewer stars | Procedural, minimal |
| Prefetch window | ±2 chapters | ±1 | ±1 (fetch only, decode late) |
| Project Bay diorama | Full 3D | Full 3D, reduced detail | Image/video dossier instead |
| Frame-rate target | 60 fps | 60 fps (≥ 45 acceptable) | 30 fps stable |

**Tier selection:**
1. Initial guess from heuristics: WebGL2 support, `deviceMemory`, `hardwareConcurrency`, screen size × DPR, Save-Data, reduced motion. These extend the heuristics already used in your current `HeroCanvas.jsx`.
2. Runtime adaptation with `PerformanceMonitor`. The step-down order is:
   1. DPR.
   2. Post-processing.
   3. Particles.
   4. Shadows.
   5. Texture tier (next chapter onward).

   Step-up is allowed only once per chapter, to avoid flip-flopping.
3. A manual override in the settings menu (High / Balanced / Low / Brief), remembered in `localStorage` (wrapped in try/catch).

## 3. Budgets & measurable targets

| Metric | Target | How measured |
|---|---|---|
| Initial JS (gzip), journey | ≤ 350 KB | Build output / bundle analyser in CI script |
| Initial JS, Mission Brief | ≤ 30 KB (0 KB acceptable) | Build output |
| First text paint of name + Resume + Brief links | ≤ 1.5 s on "Fast 4G + 4× CPU" emulation | Lighthouse / WebPageTest |
| First chapter interactive (countdown complete), Balanced | ≤ 6 s on the same emulation; ≤ 4 s on cable | Custom performance mark → Playwright trace |
| Mission Brief Lighthouse | Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95 | Lighthouse CI |
| Frame time while scrubbing, per chapter | p95 ≤ 16.7 ms (High/Balanced on reference desktop/laptop); p95 ≤ 33 ms (Low on reference phone) | Chrome Performance panel + dev overlay frame log exported to JSON |
| Long tasks during chapter entry | No task > 100 ms on reference laptop | Performance panel; Long Tasks API in dev |
| Draw calls per frame | ≤ 300 High / 150 Balanced / 80 Low | `renderer.info.render.calls` in dev overlay; Spector.js |
| Triangles per frame | ≤ 1.5M / 700k / 250k | `renderer.info` |
| GPU texture memory (estimated) | ≤ 400 MB / 220 MB / 110 MB | Sum of texture byte sizes from the asset register + `renderer.info.memory` |
| JS heap after full journey and return | No growth > 15% vs. after first pass | DevTools memory snapshot (leak check) |
| Geometry/texture count after leaving a chapter | Returns to pre-chapter baseline ±5% | `renderer.info.memory` logged at chapter boundaries |
| Cumulative Layout Shift | < 0.05 | Lighthouse |

## 4. Strategies by concern

**Initial loading**
- The HTML shell holds visible text and links (no blank screen).
- Code splitting per chapter (dynamic imports).
- The first chapter's assets are preloaded with `<link rel="preload">` for the critical GLB.
- Fonts subset and `font-display: swap`; at most 2 families.

**3D model size and texture memory**
- Meshopt + KTX2 for everything (see `ASSET_PIPELINE.md`).
- Tiered texture variants.
- Never ship PNG/JPEG textures to the GPU for 3D (UI images may be AVIF/WebP).

**Draw calls**
- Merge static meshes by material.
- Instance repeated objects.
- Texture atlases for props.
- LOD (`Detailed`) for planets and stations seen at varying distances.

**Lighting and shadows**
- Baked lighting for interiors.
- In space, one directional "Sun" key light plus environment fill.
- Shadow maps are tight (fitted to the visible subject), updated only when the light or subject moves.

**Post-processing**
- A single `EffectComposer` with merged effects.
- Tier-gated.
- Never stack effects that duplicate CSS (vignette and grain can be CSS on Low).

**Lazy loading and unloading**
- Lifecycle states in `TECHNICAL_BLUEPRINT.md` §3.2.
- Disposal is verified by the memory baseline test above.

**Thermal / battery**
- Throttle ambient rendering at rest points after 10 s of no input (lower frame rate).
- Stop rendering when the tab is hidden or when Mission Brief / Project Bay hides the canvas.

## 5. Accessibility

| Requirement | Implementation |
|---|---|
| **Reduced motion** (`prefers-reduced-motion: reduce`) | A choice between a *photo-story* mode (key frames as stills with crossfades, same text) and the Brief. No camera shake, no flashes, no parallax. |
| **Keyboard** | All controls tabbable; visible focus styles; ←/→ and PageUp/PageDown move between rest points; Esc closes overlays; a skip link to the Brief and to Contact is the first focusable element |
| **Screen readers** | Canvas is `aria-hidden`. A visually hidden, ordered outline of all chapter content is present in the DOM. The active chapter's title is announced politely on change. Overlays use semantic headings, lists and links. |
| **Contrast** | WCAG 2.2 AA for all text (4.5:1 body, 3:1 large), checked against the darkest *and* brightest frame behind each rest point (adaptive scrims) |
| **Flashing** | No more than 3 flashes per second; ignition, Sun, wormhole and art-style transitions are reviewed against this |
| **Text** | Real DOM text, resizable to 200% without loss; no text conveyed only in 3D textures |
| **Pointer targets** | ≥ 44 × 44 px on touch |
| **Audio** | Off by default; never required to understand content; captions for any spoken audio |
| **Focus management** | Project Bay traps focus while open and returns focus to the opener on close |
| **Language** | `lang` attribute; plain-language copy |
| **No-JS / no-WebGL** | The Mission Brief covers 100% of content |

## 6. How these are tested (summary; details in `DEVELOPMENT_WORKFLOW.md`)
- **Automated:** axe-core in Playwright on the Brief and on each rest point of the journey; Lighthouse CI on the Brief and the journey shell; bundle-size and asset-size scripts against budgets.
- **Semi-automated:** a dev overlay logs frame times, draw calls, triangles and memory per chapter to JSON for comparison against the previous baseline.
- **Manual, every chapter:** keyboard-only pass, screen reader spot check (NVDA on Windows; VoiceOver on iOS if a device is available), reduced-motion pass, real-device pass on your reference phone and laptop.
- **iOS caveat:** profiling Safari on iPhone requires Safari Web Inspector on a Mac. Without a Mac, iOS testing is limited to visual and functional checks plus FPS readouts from the dev overlay.
