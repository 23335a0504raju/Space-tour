# PERFORMANCE & ACCESSIBILITY PLAN (hardware-specific)

> This refines `PERFORMANCE_ACCESSIBILITY.md` (Batch 2) for **your actual hardware**.
> **Everything below is a target or an estimate. Nothing has been measured yet.** Measurements happen in spike S4 (`DEVELOPMENT_WORKFLOW.md`) and are recorded as baselines. No benchmark results are claimed.

## 1. Reference devices
| Device | Role | Notes |
|---|---|---|
| **Lenovo 83KA**: Ryzen 7 8840HS, **Radeon 780M (integrated)**, 24 GB RAM | **Primary desktop reference.** It defines the "Balanced" tier. | The iGPU shares system memory and bandwidth, so **fill rate and bandwidth are the limits**, not triangle count. The reported 4 GB is a shared allocation, not dedicated VRAM. |
| **Android phone** (model `[TO CONFIRM]`) | **Mobile reference.** It defines the "Low" tier. | The exact model, GPU and RAM are needed to set realistic mobile budgets |
| No Mac / no iPhone | — | iOS is **not testable** for profiling. iOS support is best-effort: conservative budgets, Brief fallback, and Safari-specific risks documented. |

"High" is defined but **not targeted**: it is only enabled automatically if a device clearly outperforms the 780M (and it is never required for the experience to look finished).

## 2. Quality targets
| | Desktop target (780M, "Balanced") | Mobile target (Android, "Low") |
|---|---|---|
| Frame rate | 60 fps goal; p95 frame time ≤ 20 ms while scrubbing; never below 45 fps sustained | 30 fps stable; p95 ≤ 33 ms |
| **Render pixel budget** | ≤ ~2.1 MP (about 1920×1080 internal), whatever the display resolution. DPR is capped dynamically to fit. | ≤ ~0.9 MP (DPR ≈ 1.0) |
| Anti-aliasing | SMAA in the post chain (no MSAA together with post) | FXAA or none |
| Initial download (shell + first scene) | ≤ 8 MB | ≤ 3.5 MB |
| Per-scene streamed download | ≤ 6 MB | ≤ 2.5 MB |

If your laptop panel is higher than 1080p, the pixel-budget cap matters most: rendering at native 2.5K+ on a 780M would roughly double the fill cost for little visible gain.

## 3. Geometry and texture budgets (initial estimates, per frame)
| | Balanced (780M) | Low (Android) |
|---|---|---|
| Triangles visible | ≤ 600k | ≤ 200k |
| Draw calls | ≤ 150 | ≤ 70 |
| GPU texture memory resident | ≤ 256 MB | ≤ 96 MB |
| Max texture size | 2K props; 4K only for the Earth colour map | 1K props; 2K Earth |
| Astronaut | ≤ 30k triangles, 2K textures | Same mesh, 1K textures |
| Room (static, merged) | ≤ 150k triangles | ≤ 60k (simplified variant) |
| Ship exterior / cockpit | ≤ 80k / ≤ 100k | ≤ 35k / ≤ 40k |
| Installations (each) | ≤ 40k | ≤ 15k |

## 4. Lighting and shadows
- **Room and cockpit:** baked lighting (lightmaps) if the Blender bake step is achievable (see §9). One real-time light for the astronaut. **One shadow map** (1024², tight frustum around the astronaut) on Balanced only.
- **Space:** a single directional Sun light. Planets **have no shadow maps**; their day/night terminator is computed in the shader. Saturn's ring shadow is analytic in the shader.
- **Anime universe:** toon ramp lighting with no shadow maps. Contact shadows are faked with blob decals.
- **Never:** real-time global illumination, screen-space reflections, SSAO, or ray tracing.

## 5. Particles
| System | Balanced | Low |
|---|---|---|
| Starfield (points, static) | 30k | 10k |
| Dust / ring particles (near camera) | ≤ 5k | ≤ 1.5k |
| Asteroids (instanced meshes) | ≤ 800 | ≤ 250 |
| Exhaust/smoke sprites | ≤ 300 | ≤ 100 |
| Anime particles (petals, embers, etc.) | ≤ 3k | ≤ 1k |

Particles are GPU-animated (shader time), never updated per particle on the CPU.

## 6. Post-processing
| Effect | Balanced | Low |
|---|---|---|
| Tone mapping (ACES/AgX) | ✔ | ✔ |
| Bloom | ✔ half-resolution, mipmap blur | ✘ (emissive look faked in materials) |
| SMAA | ✔ | ✘ |
| Vignette / film grain | ✔ (cheap) | CSS vignette only |
| Depth of field | ✘ (too expensive on the 780M for the benefit) | ✘ |
| Chromatic aberration, motion blur, god-rays | ✘ | ✘ |
| Outline (anime) | Inverted-hull geometry (not post) | Same, thinner |

## 7. GLB compression strategy
- Use **Meshopt** for all GLBs (including the astronaut's skin and animations). Use **Draco** only for the static room if measurement shows it's clearly smaller. Never use both on one file.
- **KTX2:** ETC1S for colour, roughness and AO; UASTC for normals and the Earth map.
- Tier variants are produced by the scripted glTF-Transform pipeline (`ASSET_PIPELINE.md`).
- Vercel serves hashed assets with long-lived immutable caching, and correct MIME types for `.glb` (`model/gltf-binary`) and `.ktx2` (`image/ktx2`). These are set in the Vercel config.

## 8. Lazy loading and unloading
| Scene group | Assets | Load when | Unload when |
|---|---|---|---|
| Room + Departure (SC02–03) | room, astronaut | at boot | after SC05 (the astronaut stays cached for SC06/SC13) |
| Cockpit (SC04, SC06 beat) | cockpit | at boot (background) | after SC06 |
| Ship exterior | ship | SC03 | never (used throughout) |
| Earth + Moon (SC05–07, SC13) | planet maps | SC03 | after SC07; reloaded during SC12 |
| Mars, belt, Jupiter + installations | maps, meshes | during SC06 | after SC09 |
| Saturn | maps | during SC08 | after SC10 |
| Anime universe | stylised meshes, particles | during SC09/SC10 | after SC12 |
| Project Bay dioramas | diorama assets | when the Bay opens (with a spinner) | when the Bay closes |

Prefetch window: ±1 scene on both tiers. Low fetches bytes ahead but decodes late.

## 9. Assumption: no Blender experience
- Baked lighting is the single biggest realism gain, and it needs Blender. **Plan:** I write a step-by-step, screenshot-free checklist for exactly three Blender tasks (import/export check, lightmap UV + bake, export). If that proves too hard, use the **fallback**: real-time lighting with an environment map and carefully placed lights. This looks less realistic, and is accepted as a documented quality trade-off.
- The **mission emblem** and the name tape are vector art (SVG) produced in code and applied at runtime as decals. No Blender needed.

## 10. Reduced-motion behaviour
On `prefers-reduced-motion: reduce`, the visitor chooses:
1. **Photo-story:** each rest point is a still frame (pre-rendered on desktop at build time, or rendered once at runtime) with crossfades and the same text. There is no camera motion, shake, parallax or flashing.
2. **Mission Brief.**

The choice is remembered (with `localStorage` failures handled safely). The ignition, gate and beacon flashes are reviewed against the three-flashes-per-second rule even in full mode.

## 11. WebGL fallback
| Condition | Response |
|---|---|
| No WebGL2 | Mission Brief, with a one-line note |
| Context lost | "Signal lost" → attempt restore → if that fails, offer the Brief |
| Sustained < 25 fps after step-downs (desktop) or < 20 fps (mobile) | Offer the Brief or photo-story (never forced) |
| Asset failure | Retry once → the scene's fallback still and text → continue |

## 12. Scroll performance strategy
- Only an invisible track scrolls. The canvas and overlays are fixed, so there's no layout work during scroll.
- One ScrollTrigger drives one progress value. GSAP timelines are seeked, and the render follows in the same tick (one clock).
- No React re-renders during scrolling (verified with the profiler per scene).
- World-anchored labels are updated by direct style writes, batched once per frame.
- Native scroll (no Lenis) with light `scrub` smoothing. Lenis is added only if testing on the 780M laptop's touchpad or mouse shows jerkiness.
- Mobile: the track height is fixed in px, so address-bar changes don't re-map progress.

## 13. Accessibility (summary; full rules in `PERFORMANCE_ACCESSIBILITY.md` §5)
Keyboard navigation (rest-point stepping, Esc, visible focus); a skip link to Brief and Contact first; the canvas `aria-hidden` with a hidden ordered content outline; WCAG AA contrast via adaptive scrims; no scroll locking; reversible animation; an `aria-live` chapter announcement; 44 px touch targets; audio off by default and never autoplayed.

## 14. How targets become measurements
1. Spike S4 measures an empty scene, a planet scene and the room on both devices, and records a baseline JSON.
2. Every scene's acceptance report lists the measured p50/p95 frame time, draw calls, triangles and download size per tier.
3. A regression of more than 10% in p95, or any budget breach, blocks approval.
4. Mission Brief: Lighthouse CI and axe on every build.
