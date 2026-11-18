---
name: webgl-performance
description: Diagnose and improve rendering performance, memory and loading for the space portfolio. Covers quality tiers, frame-time and draw-call budgets, GPU and texture memory, the asset lifecycle (prefetch, warm, dispose), mobile and iOS constraints, PerformanceMonitor-driven adaptation, and regression baselines. Use it when a chapter misses a budget, when adding shaders, post-processing or particles, when touching loading or unloading, or before any chapter's acceptance report.
---

# WebGL performance

The targets and tiers are in `docs/PERFORMANCE_ACCESSIBILITY.md`. Measure first, then change one thing at a time, then measure again.

## Inspect before changing anything
1. Read the current baseline JSON for the chapter (from the per-chapter perf log) and the tier budgets.
2. Reproduce on the **same machine and tier** as the baseline. Record frame-time p50 and p95, draw calls, triangles, texture count and estimated texture memory.
3. Identify the bottleneck before optimising:
   - **CPU / JS:** long tasks in the Performance panel, or React commits while scrubbing.
   - **Draw calls:** `renderer.info.render.calls`.
   - **Fill rate:** frame time scales with DPR. Test by dropping the DPR.
   - **Shader cost:** disable the suspect material or effect and compare.
   - **Memory and upload:** hitches when a chapter becomes warm or active.

## Levers, in order of cost-effectiveness
1. **DPR cap per tier.** Fill rate usually dominates on laptops and phones.
2. **Post-processing:** merge effects into one composer, gate by tier, and drop DOF before bloom.
3. **Draw calls:** merge static meshes by material, use instancing, use texture atlases.
4. **Shaders:** fewer noise octaves or texture taps, precomputed textures for the Low tier, no branching on uniforms in the hot path.
5. **Shadows:** one caster, a tight frustum, update only on change, none on Low.
6. **Triangles:** LOD (`Detailed`) and per-tier mesh variants.
7. **Textures:** KTX2 and a lower tier maximum size. This is the main lever for memory crashes on iOS.
8. **Overdraw and transparency:** sort and limit transparent particles, and prefer additive sprites with `depthWrite: false` in small counts.

## Lifecycle and memory rules
- The prefetch window comes from the tier (High ±2, Balanced ±1, Low ±1, fetch only).
- `warm` means decoded, uploaded and shader-compiled while hidden. Compile shaders for the hidden scene so entering the chapter doesn't stall.
- `cooling` means unmounted. R3F disposes of what it created, but anything created manually (render targets, canvas textures, generated geometry, cloned materials) must be disposed of explicitly.
- `useGLTF` caches by URL. Clear the cache entry for large chapter assets when a chapter cools, or memory will never fall.
- Stop rendering when the canvas is hidden (Brief, Project Bay without diorama, hidden tab). Reduce the frame rate at idle rest points after 10 s with no input.

## Adaptive quality
- `PerformanceMonitor` steps quality down in this order: DPR → post-processing → particles → shadows → texture tier (applies from the next chapter onward). Allow at most one step-up per chapter to prevent flip-flopping. Respect the user's manual override.
- Tier changes are discrete state changes (one React commit), never per frame.

## Mobile and iOS notes
- Safari caps at 60 fps (30 fps in Low Power Mode). Design Low for 30 fps.
- iOS kills tabs that exceed memory, so keep the texture memory budget strict and avoid more than one WebGL context.
- Touch scroll has momentum. Check that scrub smoothing doesn't feel laggy on touch, and tune it separately if needed.
- Thermal throttling appears after a few minutes, so test a full journey run, not just one chapter.

## Common mistakes to avoid
- Optimising without a baseline, or measuring on a different tier or machine.
- Comparing dev-mode numbers to production budgets (always measure production builds).
- `antialias: true` together with post-processing (wasted MSAA). Choose one AA strategy per tier.
- Leaving `r3f-perf` or stats overlays in production bundles.
- Fixing a hitch by lowering quality when the real cause is shader compilation or a texture upload on entry.

## How to verify
1. Rerun the same measurement. Report the before and after numbers per tier in a table.
2. Regression threshold: frame-time p95 must not get worse by more than 10%, and no budget may be exceeded.
3. Leak check: run the full journey forward and back, and confirm heap and `renderer.info.memory` are within the limits in §3 of the performance doc.
4. Run the bundle-size and asset-size scripts.
5. Update the chapter's baseline JSON only after the user approves the chapter.
