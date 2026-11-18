---
name: r3f-scenes
description: Build or modify 3D chapter scenes for the cinematic space portfolio with Three.js and React Three Fiber, covering chapter modules, the camera director and shots, lighting, materials, shaders, GLB model integration, the astronaut and ship controllers, and art-style profiles (realistic or anime). Use it whenever a task touches anything inside the WebGL canvas.
---

# R3F scenes: cinematic portfolio

The architecture lives in `docs/TECHNICAL_BLUEPRINT.md`. This skill is the working rulebook for it.

## Inspect before changing anything
1. Read `docs/TECHNICAL_BLUEPRINT.md` §3 (chapter contract), §5 (camera) and §6–7 (astronaut and ship).
2. Read `docs/STORYBOARD.md` for the scene being built, and check `docs/CREATIVE_DECISIONS.md` to see whether it is confirmed.
3. Open `src/chapters/_registry.ts` and one existing chapter folder. Copy its structure; don't invent a new one.
4. Check `src/engine/assets` (the manifest) and `assets/ASSET_REGISTER.md` to confirm the assets exist and are licensed.
5. Check installed versions in `package.json`. Verify any API you are unsure of against the official docs (r3f.docs.pmnd.rs, drei.docs.pmnd.rs, threejs.org/docs) instead of relying on memory.

## The non-negotiable rules
- **A chapter is a module that follows the contract:** meta, content keys, asset manifest, Scene, timeline factory, shots, overlay, fallback and brief mapping. Adding a destination means one new folder and one registry line, with no engine edits unless the contract itself is missing something. If it is, stop and propose the contract change.
- **Story state is a pure function of progress.** A scene reads its values from the rig state, which the timeline writes. A scene never animates story values with `delta`, never accumulates values across frames, and never uses `Math.random()`; use the seeded RNG instead.
- **Ambient motion** (shader time, cloud drift, idle breathing) may use `delta`/clock time. It must never change story meaning.
- **One camera, owned by the Camera Director.** Chapters export *shots* (spline dolly, orbit, attached, locked) with `portrait`, `landscape` and `ultrawide` variants. Never call `camera.position.set` from a chapter.
- **Each chapter uses its own local origin.** Never place objects at planetary distances (>1e5 units). Keep the subject near the origin and fake scale with FOV, parallax layers and fog.
- **The astronaut controller** sets each action's `time` and `weight` from the timeline, then calls `mixer.update(0)`. A walk derives clip time from distance ÷ stride, and the clips are in-place. Do not use `action.play()` with wall-clock playback for story motion.
- **The ship** is a rigid transform sampled from a chapter spline. Exhaust, RCS and glow are uniform parameters, not simulations.
- **Art style** comes from the chapter's style profile (`realistic`, `anime`, …), which sets tone mapping, the post set, the light rig and material variants. Never hand-tune exposure per chapter without recording it in the profile.

## Implementation practices
- Load models with `useGLTF` (Meshopt decoder configured once) and KTX2 textures through the shared loader setup. Do not create ad-hoc loaders in `useEffect`.
- Find model parts **by node name** (`Ship_Hatch`, `Astro_Helmet`), as the asset pipeline guarantees. Never rely on child indices.
- Share geometries and materials, and create them in `useMemo` or at module scope. Use `<instancedMesh>` for any repeated object (more than about 20 copies).
- Use `visible={false}` while a chapter is `warm`. Mount and unmount only on lifecycle transitions, never per frame.
- Write custom shaders in `src/shaders/`. Every shader must have a reduced-cost path selected by tier (fewer noise octaves, no extra texture taps).
- Use baked lighting for interiors (lightmap on the second UV set). In space, the Sun is the single directional key light plus a weak environment fill.
- For world-anchored DOM labels, project positions in `useFrame` and write CSS transforms directly to element refs. Never use `setState`.
- Hit-testing uses invisible low-poly proxies, never the full meshes.
- Dispose of anything you created manually (render targets, canvas textures, generated geometry) in the cleanup function.

## Common mistakes to avoid
- `setState` or Zustand `set` inside `useFrame`, scroll handlers or pointermove (this causes React re-render storms).
- `new THREE.Vector3()` inside `useFrame` (creates garbage every frame). Hoist temporary objects instead.
- Animating story elements with `delta`, which breaks reverse scrolling.
- Using drei `ScrollControls`, `OrbitControls` in production, or a second `<Canvas>`. Project Bay and dioramas render in the same canvas.
- Real-time shadows on many lights, or shadow maps covering the whole scene.
- Loading full-resolution PNG/JPEG textures for 3D (always use KTX2).
- Using text baked into textures as the only copy of content (the DOM must have it too).

## Lessons verified in P1–P3 (each one cost a debugging session)
- **Never set `scene.environment` in a chapter.** Declare `environment: { key, intensity }` in the ChapterImpl and register the texture via `engine/environment.ts`; the Director applies it. Neighbouring chapters are mounted at the same time.
- **`material.envMapIntensity` is ignored when lighting comes from `scene.environment`.** three r187 uses `scene.environmentIntensity` instead (`WebGLRenderer.js`). For surfaces that must not reflect the active IBL (exteriors seen through windows, window glass), use `meshLambertMaterial` or `meshBasicMaterial`. Otherwise grazing-angle Fresnel turns night ground grey.
- **Exactly one tone-mapping stage.** With the Balanced post chain, the `ToneMapping` effect owns it and `gl.toneMapping` is `NoToneMapping` (`ToneMappingOwner` in Journey). Doubling it lifts night blacks.
- **Bloom threshold ≥ 1 (HDR).** Lower thresholds wash a haze over dark frames. Emissive "lights" use moderate intensities (2–3), not 8.
- **Clone GLTF scenes** (`scene.clone(true)`) when the same model appears in more than one chapter; an Object3D has one parent.
- **Spot lights need a target in the scene graph** (`TargetedSpot` pattern); an un-added target always points at the origin.
- **Hooks returning objects must memoise them**, and default object params must be module constants; otherwise you get render loops or leaks.
- **Start and stop animation actions in the same effect** (StrictMode's simulated unmount); foot-lock walks with toe bones.
- **Check camera paths against subjects.** Compute where the camera ray passes the astronaut/props at each key; review frames with `node scripts/capture-shots.ts <chapter>:<t,…>`. Note: t = 0 and t = 1 sit on boundary dips, so use 0.05 and 0.95.

- **Quantized GLBs lie about units.** The astronaut's positions are normalized to ±1 (KHR_mesh_quantization), so the node scale (0.01) is not metres per unit. Measure it (bind-pose height ÷ geometry bbox height) before any shader offset; the first try inflated the body by a metre.
- **Never offset a flat-shaded mesh along `normal`.** Split normals crack every hard edge. Weld them: average the normals of coincident positions into a separate attribute (`suit.ts` `smoothNormals`).
- **Shared, ref-counted resources must unregister on the *last* user only.** SC02 unmounting dropped the "room" IBL that SC03/SC04 still used, and the cockpit went dark after a jump.
- **Props the character walks past are story state.** Move them as a pure function of t (chair push-back, door opening from walked distance), and unit-test the clearance (`greybox/departure.test.ts`).

- **The R3F clock is in seconds; never pass milliseconds to `advance()`.** With `frameloop="never"`, R3F stores the value passed to `advance()` as `clock.elapsedTime` and derives `delta` from it. P2–P4 passed ms, so every ambient loop ran 1000× too fast (frantic typing). `engine/clock.test.ts` guards it.
- **Dispose memoised GPU resources with `useDisposeOnUnmount`** (`engine/lifecycle.ts`), not `useEffect(() => () => x.dispose())`. StrictMode's simulated unmount freed resources still in use: actions crashed and programs were queried after deletion. Never `mixer.uncacheRoot` in a cleanup.
- **Test in the dev server too**, not only `npm run preview`: StrictMode bugs only show in dev. `node scripts/console-check.ts <url> [p,p,…]` lists console warnings and errors.
- **Inline `ref` callbacks re-run on every re-render.** Never reset per-element engine state in one: the overlay ref reset the Director's `last/visible` and a passed panel stayed on screen (P4). Keep the entry when the element is the same.
- **Check memory with round trips, and run a control.** `capture-shots … --perf` prints live textures/buffers. Go A → B → A several times; growth on every trip is a leak. Repeat with a chapter that never mounts B to find out who owns it. Per-clone geometry, skeleton bone textures and per-call materials were the P3 leaks.
- **AgX turns bright colours white.** Keep additive effects (plumes, glows) saturated and below ~1.2 except a small hot core, or they read as grey tubes.
- **Night exteriors need a far-plane plan.** Far = 2 km: compress altitudes, use a camera-centred sky dome, and dissolve every flat layer (ground, clouds) into the horizon colour before the far edge.
- **Never write backticks inside `node -e` in Git Bash** (the shell executes them); write a script file instead. A test edit was mangled this way in P4.

## Performance considerations
Follow the budgets in `docs/PERFORMANCE_ACCESSIBILITY.md` §3: draw calls, triangles and texture memory per tier. Check `renderer.info` in the dev overlay before and after your change. Precompile shaders for the hidden scene during `warm` to avoid a hitch on entry. Load the `webgl-performance` skill for deeper work.

## How to verify
1. In isolation mode with the dev scrubber, sweep local t from 0→1 and 1→0 at every aspect class, and confirm the rest-point frames match.
2. Run the unit tests: path-independence and sweep tests for the chapter must pass.
3. In the dev overlay, check draw calls, triangles and frame-time p95 against the tier budgets, at all three tiers.
4. Leave the chapter and confirm `renderer.info.memory` returns to the baseline (±5%).
5. In the React DevTools profiler, confirm there are zero commits while scrubbing inside the chapter.
6. Report the results with numbers. Don't write "it works" without evidence.
