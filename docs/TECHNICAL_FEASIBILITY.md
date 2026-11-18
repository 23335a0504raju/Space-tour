# TECHNICAL FEASIBILITY

> Status: **Batch 1 analysis.** No technology stack is selected here. Tools are named only as *examples* of categories so the effort is concrete. The stack is decided in a later batch.

---

## 1. Summary verdict

The concept is **achievable for a solo developer**, *if* three conditions hold:
1. **Character and environment realism comes mainly from purchased or free assets plus baked lighting**, not from real-time photorealism.
2. **Character animation stays within a small library of standard motions** (sit, type, stand, walk, reach, idle). Bespoke interactions are hidden with cuts.
3. **Planets, the Sun, atmospheres, the wormhole and the "Unbuilt" effect are built in code (shaders)**. This is where frontend skill gives the biggest visual return for the least asset cost.

The largest risks are **astronaut animation quality**, **total download size** and **mobile GPU performance**, in that order.

---

## 2. Classification of work

### A. Achievable through frontend code alone
| Element | Notes |
|---|---|
| Scroll → master timeline, reversibility, dwell zones, snapping | Core engineering task; reversal is "free" if everything derives from one progress value |
| Camera choreography (spline paths, look-at targets, easing, shake) | Authored as curves; could optionally be authored in Blender and exported |
| Planet rendering (Earth, Moon, Mars, Jupiter, Saturn) | Spheres + public texture maps + custom shaders (atmosphere rim, night lights, clouds) |
| Sun (granulation, corona, prominences) | Procedural shader + bloom |
| Saturn ring layering and labels | Ring shader + UI |
| Asteroid belt | GPU instancing of 3–5 rock meshes |
| Starfields, Milky Way (procedural option), nebula | Shaders / point clouds; or a panorama image |
| Spectroscopy UI at the Sun | 2D/3D UI, fully code |
| Wormhole lensing | Screen-space distortion shader |
| "Unbuilt" wireframe-to-solid effect | Shader mixing wireframe/edge rendering and full materials |
| Diegetic cockpit screens | HTML or canvas rendered into textures |
| Clouds during ascent (stylised) | Layered textured planes + fog; not true volumetrics |
| Mission Brief mode, navigation, overlays, accessibility | Standard frontend |
| Smart Way Traffic diorama (if the concept fits) | Procedural roads, vehicles and signals: largely code |
| Loading countdown with real progress | Asset-loader events |

### B. Requires existing 3D models / animation assets (free or purchased)
| Asset | Likely source category | Notes |
|---|---|---|
| Astronaut (rigged, modern suit) | Marketplaces (e.g. Sketchfab, Fab, CGTrader) | Must be humanoid-rigged or rig-able; must have a clean licence |
| Standard animations (idle, sit-type, stand-up, walk, reach) | Auto-rig/motion libraries (e.g. Mixamo) | Retargeting onto the astronaut is usually straightforward |
| Room interior and props (desk, monitors, books, lamp, chair) | Asset packs, free PBR libraries (e.g. Poly Haven) | Needs assembling and lighting |
| Spaceship exterior | Marketplace | Should be "near-future crew capsule", not fighter style |
| Cockpit interior | Marketplace or simplified custom | Only the camera-visible portion is needed |
| Launch pad / tower | Marketplace (low detail is fine; mostly silhouetted) | |
| Voyager 1 | NASA 3D resources (check licence/attribution) | |
| Planet textures | Public NASA-derived texture sets (check licences, often CC BY) | |
| Sky panorama | ESA/NASA imagery (check licence) or procedural | |
| Orbital station (modular) | Marketplace kit-bash or simple custom | One model, re-dressed per project |

### C. Requires custom modelling, rigging or external creative tools
| Task | Tool category | Why it can't be pure code |
|---|---|---|
| **Baking room lighting** (lightmaps / AO) | Blender | Real-time GI on the web is too expensive; baked light is what makes interiors look realistic |
| Mission patch and name tape on the suit | Image editor + Blender texture work | Custom identity |
| Door frame / hatch frame silhouette match | Blender | The match cut needs both frames designed together |
| Custom animation for door opening, helmet pickup and beacon planting | Blender (or cut around them) | Not in standard motion libraries; recommendation: **cut around**, use a hand-reach plus an object animation |
| Asset optimisation (decimation, texture atlasing, compression) | Blender + glTF tooling | Mandatory for web budgets |
| Station dressing per project | Blender | Decals and colours per project |
| Optional: camera paths authored in 3D | Blender | Easier art direction than code-only curves |

### D. Possible but too expensive / unnecessary
| Idea | Why to avoid | Cheaper equivalent |
|---|---|---|
| Photoreal human face / facial animation | Uncanny valley, huge cost | Gold reflective visor |
| Physically accurate volumetric clouds | Very GPU-heavy, especially on mobile | Layered cloud planes + fog + motion blur |
| Real-time global illumination / ray tracing | Not viable across devices | Baked lighting |
| Full house + exterior environment | Weeks of modelling | One room + match cut |
| Accurate orbital mechanics / true scale | True scale is invisible on screen | Artistic scale with "plausible" cues |
| Motion-captured custom performances | Specialist work | Motion library + camera cuts |
| Separate full 3D world per project | Asset and load bloat | Tiered presentation |
| Fluid/particle-simulated rocket exhaust | Heavy | Shader-based plume + sprite smoke |
| Pre-rendered video for the whole film | Huge files; scroll-scrubbing video is janky without special encoding | Real-time rendering; video only as a possible fallback for one heavy shot |

---

## 3. Required 3D assets (inventory)

| ID | Asset | Detail level | Reuse |
|---|---|---|---|
| M1 | Astronaut (rigged) | Hero | S01–S05, S10, S19 |
| M2 | Helmet (separate mesh) | Hero | S02–S03 |
| M3 | Room shell + window + door | Hero (baked) | S01–S04 |
| M4 | Desk props set (monitors, books, lamp, chair, corkboard) | Hero/mid | S01–S03 |
| M5 | Hatch frame | Mid | S04–S05 |
| M6 | Cockpit interior (visible portion) | Hero | S05, S07, S10 |
| M7 | Ship exterior (with heat-shield side) | Hero | S06–S19 |
| M8 | Launch pad / tower | Low | S06 |
| M9 | Earth (sphere + maps) | High-res textures | S08, S09 |
| M10 | Moon (sphere + terrain strip) | High-res | S01 backdrop, S09 |
| M11 | Mars | Mid | S11 |
| M12 | Asteroids ×3–5 | Low | S12 |
| M13 | Jupiter | Mid | S13 |
| M14 | Orbital station (modular) | Mid | S13 |
| M15 | Project diorama assets (Tier 1) | Mid | S13 overlay |
| M16 | Saturn + rings | Mid | S14 |
| M17 | Voyager 1 | Mid | S15 |
| M18 | Platform + beacon | Mid | S19 |

## 4. Required animation assets

| ID | Animation | Source |
|---|---|---|
| A1 | Seated idle + typing | Motion library |
| A2 | Seated look-up | Motion library |
| A3 | Sit-to-stand | Motion library |
| A4 | Walk (in-place, for distance-locked stepping) | Motion library |
| A5 | Reach (door / switch) | Motion library + edits |
| A6 | Sit-down into seat | Motion library |
| A7 | Standing idle (low gravity, subtle) | Motion library |
| A8 | Kneel / plant (beacon) | Motion library or cut around |
| A9 | Object animations: door, hatch, screens, clamps, beacon | Code or Blender |

---

## 5. Main technical challenges

1. **Scroll-scrubbed character animation.** Animations are driven by timeline progress rather than real time. Walking must tie step phase to distance travelled, or feet slide. Blending between clips must be deterministic so reversing never pops.
2. **Single master timeline across many scenes.** Each scene needs to activate, deactivate and preload by progress ranges. Chapter jumps must reconstruct the exact state at any point, not replay from the start.
3. **Scene streaming.** The whole film cannot live in GPU memory at once. Assets for the next scene load and the previous scene's assets are released, with no hitching at boundaries.
4. **Scale and precision.** Space distances break floating-point precision. Each scene needs its own local origin, and the cuts are what make the scale feel continuous.
5. **Match-cut continuity.** The door → hatch cut and the Sun slingshot need precise framing on every aspect ratio.
6. **Readable text over 3D.** Contrast must hold on a bright Sun, white clouds and a dark sky. HTML text layers with adaptive scrims are needed.
7. **Overlay ↔ timeline handoff.** Project Bay pauses the timeline and resumes at the exact frame, including with smooth scrolling.
8. **Portrait framing.** Each shot needs a mobile camera variant, not just a narrower field of view.

## 6. Performance risks

| Risk | Impact | Mitigation |
|---|---|---|
| Total download size (models + 4K–8K planet textures) | Slow first load, drop-off | Budget the first scene at **≤ 5–8 MB**; stream the rest; GPU-compressed textures; mesh compression; 2K textures on mobile |
| Character skinning + real-time shadows | Frame drops on laptops | Baked room shadows; one shadow-casting light at most; low-bone rig |
| Post-processing stack (bloom, DOF, motion blur, tone mapping) | Heavy on integrated GPUs | Per-device quality tiers; DOF only on desktop |
| Too many draw calls in the room and belt | CPU-bound frames | Merge static meshes; instancing |
| Shader compilation stutter on scene entry | Visible hitch | Precompile/warm up shaders during preceding scenes |
| Memory pressure on iOS Safari | Tab crashes | Strict texture memory budget; dispose of assets aggressively |

## 7. Mobile constraints

- Lower device pixel ratio cap, reduced post-processing and 2K textures.
- No real-time shadows; baked only.
- Portrait-specific camera framings for every rest point.
- Touch scroll has momentum differences, so smoothing must be tuned separately.
- Low-capability detection → offer **Mission Brief** or a "light" version upfront.
- Battery/thermal: cap the frame rate in idle dwell zones; pause rendering when the tab is hidden.

## 8. Accessibility requirements

- `prefers-reduced-motion` → static photo-story or Mission Brief.
- All text in the DOM (never baked into textures only); diegetic screens mirror DOM text.
- Full keyboard navigation between rest points; visible focus; Esc closes overlays.
- Contrast ≥ WCAG AA on all text over imagery.
- Screen-reader landmarks per chapter; 3D canvas marked decorative, with content provided in parallel.
- No flashing above safe thresholds (ignition, Sun and wormhole need care).

## 9. Potential simplifications (if time or budget tightens)

Ranked from least to most visible loss:
1. Merge S07 (Ascent) into S06 (Ignition), and S16 (Deep space) into S15.
2. Replace the ascent cloud layers with a simple sky-gradient transition.
3. Replace the Tier 1 diorama with a Tier 2 dossier (it can be added later).
4. Replace the Voyager model with a distant silhouette.
5. Reduce Mars outposts to a single orbit pass with mission-log text.
6. Replace the astronaut's walk with a cut (seated → at door).
7. Ship the full cinematic experience on desktop only and serve Mission Brief on mobile (last resort).

## 10. Suggested phased delivery (for later batches, not committed)

1. **Vertical slice:** S01–S05 (room, astronaut, match cut, cockpit). This proves the hardest parts: character, baked lighting and the scroll timeline.
2. Space pipeline: S08–S10 (Earth, Moon, Sun). Proves shaders and scene streaming.
3. Content core: S11–S14.
4. The Edge and the ending: S15–S19.
5. Mission Brief, mobile tuning, accessibility and performance passes (parallel throughout, not at the end).

**The vertical slice should be built first** because it carries the most uncertainty (asset quality and animation). If it looks right, the rest is predictable work.
