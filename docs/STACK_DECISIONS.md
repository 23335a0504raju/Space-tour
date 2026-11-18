# STACK DECISIONS

> Versions were checked against the npm registry on **2026-11-16** (`npm view`). Nothing has been installed. Exact versions are pinned at install time in Batch 3; re-check at that point.
> Sources are official documentation unless noted. Where I relied on memory instead of a fetched source, the item is marked **[verify in spike]**.

## 1. Final recommended stack

| Layer | Choice | Version seen | Status |
|---|---|---|---|
| Language | **TypeScript** (strict) | 7.0.x latest; 6.x available | ✅ Recommended (see §3.2 for version caveat) |
| Build / dev server | **Vite** + `@vitejs/plugin-react` | 8.3.x | ✅ Recommended |
| UI | **React 19** | 19.3.x | ✅ Recommended |
| 3D engine | **Three.js** (WebGL2 renderer) | 0.187 | ✅ Recommended |
| React ↔ Three | **React Three Fiber v9** | 9.8.x | ✅ Recommended |
| 3D helpers | **Drei** (selective imports only) | 10.7.x | ✅ Recommended |
| Post-processing | **@react-three/postprocessing** (pmndrs `postprocessing`) | 3.2.x | ✅ Recommended (tier-gated) |
| Animation + scroll | **GSAP + ScrollTrigger** (+ `@gsap/react` for DOM cleanup) | 3.15.x | ✅ Recommended: the **single** animation system |
| Smooth scrolling | **Lenis** | 1.3.x | 🟡 **Not in the initial stack**; can be added later (see §3.6) |
| App state | **Zustand** (already a dependency of R3F) | — | ✅ Recommended for *discrete* state only |
| 3D authoring | **Blender** (free) | 4.x/5.x | ✅ Required tool |
| Model format | **glTF 2.0 binary (.glb)** | — | ✅ |
| Geometry compression | **Meshopt** by default; Draco only case by case | — | ✅ |
| Texture compression | **KTX2 / Basis Universal** | — | ✅ |
| Optimisation CLI | **glTF-Transform** (`@gltf-transform/cli`) + KTX-Software | 4.5.x | ✅ Dev tool only |
| Unit tests | **Vitest** | — | ✅ Dev only |
| E2E / visual / a11y | **Playwright** + `@axe-core/playwright` | — | ✅ Dev only |
| Dev profiling | `r3f-perf` or `stats-gl` (dev only), Spector.js (browser extension) | — | ✅ Dev only |
| Web Workers (custom) | **None initially** | — | ❌ Not needed (see §3.9) |

**Total runtime libraries: React, React-DOM, three, R3F, drei (tree-shaken), postprocessing, GSAP, Zustand.** That is all.

## 2. The one rule this stack exists to enforce

> **One clock, one progress value, one animation system.**
> Scroll position → ScrollTrigger → master timeline playhead → everything (camera, character, ship, light, DOM text).
> React renders *structure* (which chapter is mounted). It never renders *motion*.

Section 3.6 explains why this rules out several popular combinations.

## 3. Technology-by-technology analysis

### 3.1 React 19
- **Role:** composition of chapters, DOM overlays, navigation, Mission Brief, Project Bay UI.
- **Why:** you already know it, R3F requires it, and Mission Brief can be prerendered with React's static rendering APIs.
- **Limits:** React re-renders are too slow for per-frame work. All motion stays outside React (refs, GSAP, `useFrame`).
- **Overlap:** none. **Necessary:** yes.

### 3.2 TypeScript
- **Role:** typing for the chapter contract, content schema, asset manifest and timeline APIs. This is a large, long-lived codebase where contracts matter.
- **Caveat:** TypeScript **7.0** (the native Go compiler) is now `latest`. Reports say 7.0 lacks a stable programmatic API until 7.1, which may affect tools such as `typescript-eslint` ([TS 7 RC announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/)). Vite itself strips types without the TS compiler, so the build is unaffected.
- **Decision:** use TS 7 for `tsc --noEmit` type-checking **if** the chosen lint stack supports it at install time; otherwise pin the 6.x line. **[verify at install]**
- **Necessary:** strongly recommended.

### 3.3 Vite 8
- **Role:** dev server, bundling, code splitting per chapter, asset hashing, multi-page build (journey + Mission Brief).
- **Why:** standard modern React tooling, fast HMR, and a native ES-module pipeline. Vite 8 uses Rolldown as its single bundler ([Vite 8 announcement](https://vite.dev/blog/announcing-vite8)).
- **Limits:** Node ≥ 20.19 / 22.12 is required (your machine has Node 24.16 ✔). `@vitejs/plugin-react` v6 uses Oxc instead of Babel, which is irrelevant to us.
- **Rejected alternatives:**
  - *CRA*: deprecated.
  - *Next.js*: SSR, a server runtime and an opinionated router add nothing for a single WebGL experience. Static output is possible, but heavier than needed.
  - *Astro*: excellent for Mission Brief, but a second framework next to an R3F app adds complexity.
  - *TanStack Start (crimson repo)*: SSR server and vendor config.
- **Necessary:** yes.

### 3.4 Three.js (WebGL2 renderer)
- **Role:** rendering, materials, shaders, loaders (GLTF, KTX2, Meshopt, Draco), animation mixer.
- **WebGPU?** Three's `WebGPURenderer` exists, but the pmndrs `postprocessing` library is WebGL-only, and WebGPU support on mobile Safari and older Android is still uneven. **Decision: WebGL2 now.** The consequence is that custom GLSL shaders would need rewriting in TSL to move to WebGPU later. We accept that cost, because this is a portfolio, not a long-lived engine.
- **Necessary:** yes.

### 3.5 React Three Fiber v9 + Drei
- **R3F role:** a declarative scene graph per chapter, Suspense-based loading, lifecycle and disposal, `useFrame` for per-frame reads, `PerformanceMonitor` for adaptive quality ([R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)).
- **Why R3F over plain Three.js:** chapters mount and unmount as components, assets are cached through `useLoader`, and disposal is automatic. That fits a chapter registry. Plain Three.js would need a hand-built scene manager doing the same job.
- **R3F rules we will follow** ([R3F pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)):
  - No `setState` in `useFrame` or in fast events.
  - Mutate refs.
  - Reuse geometries and materials, and use instancing.
  - Prefer `visible` over remounting.
  - Use delta-based ambient motion.
- **Drei role:** `useGLTF` (with Meshopt/Draco), KTX2 loading, `Detailed` (LOD), `PerformanceMonitor`, `AdaptiveDpr`, `useProgress`, `Preload`. **We will not use** drei's `ScrollControls`, because it competes with ScrollTrigger (see §3.6).
- **Limits:** R3F adds a reconciliation layer. Fine for scene structure, irrelevant for per-frame mutation.
- **Overlap:** drei `ScrollControls` overlaps with ScrollTrigger and is **rejected**. Drei `CameraControls` and `OrbitControls` are for a **dev-only** free camera.

### 3.6 GSAP + ScrollTrigger, Lenis, and why there is only one controller
- **GSAP role:** every authored animation (camera shot parameters, character clip time, ship transforms, light intensities, overlay text), arranged as **paused timelines** whose playheads are set from scroll. Seeking a GSAP timeline is deterministic, so **reverse scrolling is exact by construction**.
- **ScrollTrigger role:** one trigger on a tall, invisible scroll track (`start: top top`, `end: bottom bottom`) that drives the master timeline playhead (`scrub`). "Assigning an animation to a ScrollTrigger pauses it, and the ScrollTrigger drives its playhead" ([ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)).
- **Licensing:** GSAP, including all formerly paid plugins, is free for commercial use. The only restriction is building no-code animation tools that compete with Webflow, which doesn't apply here ([GSAP licensing](https://gsap.com/licensing/)).
- **Candidate conflicts and how they are resolved:**

| Combination | Problem | Resolution |
|---|---|---|
| Lenis smoothing **and** `scrub: <number>` | Double smoothing: laggy, "floaty" and imprecise | **Exactly one smoothing layer** |
| drei `ScrollControls` **and** ScrollTrigger | Two sources of scroll truth | Don't use `ScrollControls` |
| framer-motion for DOM **and** GSAP for 3D | Two timelines can't be scrubbed together, so reversal drifts | GSAP for DOM too |
| GSAP tweening React state | Re-render every frame | GSAP tweens plain objects and refs only |
| Lenis on its own rAF **and** GSAP ticker **and** R3F loop | Three clocks, so frame-order jitter | One clock (see below) |

- **Smoothing decision:** start with **ScrollTrigger `scrub: <seconds>` and native scroll (no Lenis)**.
  - Our page has no scrolling content (canvas and overlays are fixed), so smoothing the *playhead* gives the cinematic feel.
  - Native scroll keeps the browser's accessibility, keyboard and touch behaviour, and iOS momentum.
  - It means one fewer library.
  - **Lenis remains a reversible option.** If wheel-stepping on Windows mice still feels jerky in testing, switch to Lenis with `scrub: true` using the official integration (`lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t*1000))`, `gsap.ticker.lagSmoothing(0)`) ([Lenis README](https://github.com/darkroomengineering/lenis)). Never use both smoothers.
- **Clock decision:** drive R3F rendering from GSAP's ticker (R3F `frameloop="never"` plus `advance()` called in `gsap.ticker`). The timeline then updates *before* the render in the same frame. **[verify in spike S1]** The fallback is R3F's own loop, reading the already-updated rig state in `useFrame` with a high priority.
- **`@gsap/react` (`useGSAP`)** is used for DOM overlay animations so GSAP contexts are reverted on unmount.
- **Mobile:** use `ScrollTrigger.config({ ignoreMobileResize: true })` and a scroll-track height computed in px from the large viewport, so address-bar show/hide doesn't trigger refreshes. **[verify in spike S1]** Evaluate `ScrollTrigger.normalizeScroll` only if iOS shows sync problems, because it moves scrolling onto the JS thread.

### 3.7 Zustand
- **Role:** discrete app state, such as active chapter, loaded assets, quality tier, overlay open, reduced motion and audio enabled. Components subscribe with selectors; per-frame code reads `getState()` without subscribing.
- **Why not React Context:** context re-renders every consumer on change. Zustand selectors avoid that.
- **Overlap:** none. It is already shipped as a dependency of R3F. **Necessary:** small but useful.
- **Never store** scroll progress or per-frame values in reactive state. They live in a plain mutable "rig" object.

### 3.8 Blender, glTF/GLB, Meshopt, Draco, KTX2, glTF-Transform
- **Blender:** the only free tool that covers modelling fixes, UVs, **lightmap baking**, retargeting cleanup and glTF export. It is required (see `ASSET_PIPELINE.md`).
- **GLB:** a single binary file holding mesh, skin, animations and materials, with the best loader support in Three.
- **Meshopt vs Draco:**
  - Meshopt decodes faster, also compresses **animation and morph data**, and gzips/brotlis further. It is our default.
  - Draco compresses **static geometry** harder but decodes more slowly, and its WASM decoder is larger. Use it only where measurement shows a meaningful win (e.g. a dense static room).
  - **Never apply both to one file.**
- **KTX2 (Basis):** textures stay compressed **in GPU memory**, unlike PNG/JPEG, which expand to full RGBA. This is the single biggest mobile memory saver.
  - Use ETC1S for colour, roughness and AO (small).
  - Use UASTC for normal maps and hero textures (higher quality).
- **glTF-Transform CLI:** a scripted optimisation pipeline (`dedup`, `prune`, `weld`, `resize`, `meshopt`, KTX2 encoding). KTX2 encoding requires **KTX-Software** installed separately. **[verify at setup]**

### 3.9 Web Workers
- Three's KTX2, Draco and Meshopt decoders **already run in workers or WASM**.
- Procedural data such as asteroid matrices and starfields costs milliseconds and runs once.
- An `OffscreenCanvas` render-in-worker approach complicates DOM interaction and Safari support.
- **Decision: no custom workers.** Revisit only if profiling shows main-thread stalls from our own code.

### 3.10 Other candidates considered and rejected
| Candidate | Why rejected |
|---|---|
| framer-motion / Motion | Second animation system; can't share the scrubbed timeline |
| Theatre.js | Excellent visual timeline editor, but a second sequencing system and a heavy studio dependency. Could be reconsidered as an *authoring* tool if camera choreography in code proves slow. |
| Spline | Heavy runtime, limited control, closed format |
| Leva | Not needed in production; a custom dev scrubber suffices (optional dev-only) |
| detect-gpu | Fetches benchmark data from a CDN at runtime; heuristics plus `PerformanceMonitor` are enough |
| Tailwind | Optional. The design is mostly bespoke typography and fixed overlays; plain CSS modules with design tokens are sufficient. **Decision pending your preference.** |
| A router library | Two entry pages (journey, Brief) plus hash or query state for chapters don't need one |

## 4. Irreversible or expensive-to-reverse decisions (with consequences)
| Decision | Consequence if changed later |
|---|---|
| R3F (vs vanilla Three) | Rewriting the scene layer |
| GSAP as the sole animation system | Every timeline is rewritten if replaced |
| WebGL2 (vs WebGPU) | GLSL shaders must be ported to TSL to switch |
| Chapter contract (see `TECHNICAL_BLUEPRINT.md`) | All chapters depend on it, so it must be validated in the vertical slice before scaling |
| New project in `c:\projects\Portfolio` (vs inside `port`) | Low risk; the old site stays deployable |
