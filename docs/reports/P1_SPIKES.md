# P1 Spike Report

> Date: 2026-11-16 · Phase: P1 (`DEVELOPMENT_WORKFLOW.md` §1) · Status: **awaiting approval + Android run**
> Everything below was **measured**, except where marked *not yet measured*.
> Automated runs used locally installed Google Chrome (headless) on the reference laptop. Chrome reported the GPU as **"ANGLE (AMD Radeon 780M Graphics, Direct3D11)"**, so this is the real GPU, not a software renderer.

## How to reproduce
| Command | What |
|---|---|
| `npm run spikes:assets` | Download + optimise the stand-in model (never committed) |
| `npm run dev`, then open `/spikes/` | Interactive spikes S1, S2, S4 |
| `npm run test:spikes` | Automated checks for S1, S2, S4 (installed Chrome) |
| `S4_FULL=1 S4_W=1920 S4_H=1080 npm run test:spikes -- -g "S4 full"` | Full benchmark, JSON written to `spike-results/` |
| `npm run dev:lan` | Serve to the Android phone on the same Wi-Fi |

---

## S1: Scroll + single clock + reversibility ✅ PASS
Setup: one ScrollTrigger (`scrub: 0.6`, native scroll, **no Lenis**) drives one master progress. R3F uses `frameloop="never"` and renders from `gsap.ticker` via `advance()`. A grey-box flight through all 14 registry chapters.

| Check | Result |
|---|---|
| Reversibility: state hash at 37% arriving from below vs. above | **Identical** (`-5.957, 0.503, -114.287`) |
| Single clock: timeline update and render in the same tick | **99.8%** (409/410). The single miss is consistent with the first frame. |
| Chapter jump (Projects → Contact) renders only the target | **✓** rendered `[sc13-transmission]` only |
| Frame time while scrolling (1280×800) | p50 16.7 ms, p95 17.3 ms; one 96.9 ms frame at start (first shader compile) |
| Console errors | None (after adding the spike page favicon) |

**Conclusions**
- The single-clock design (`advance()` from `gsap.ticker`) works. **Adopt it for the engine.**
- Lenis is **not needed** on the evidence so far. ⚠️ Subjective feel with your touchpad, mouse wheel and Android touch is *not yet tested*. Please try `/spikes/?s=s1`.
- The 96.9 ms first frame confirms the plan's "pre-compile shaders while a chapter is warm" rule is necessary.

## S2: Scroll-scrubbed character, foot-locked walk ✅ PASS (with a stand-in model)
Stand-in: `Soldier.glb` from the three.js examples (MIT; the animations originate from Mixamo). It is never shipped. 11,376 triangles; Idle/Walk/Run clips, in place.

| Check | Result |
|---|---|
| Walk speed measured automatically from the clip (toe bones) | 1.716 m/s along z (125 planted samples) |
| Reversibility: state hash forward vs. backward | **Identical** (`0.000, -3.000, 0.715`) |
| Foot slide while walking | **max 0.57 cm/frame; 4.1% of travel**. Not visible; residual is toe roll. |
| Meshopt + WebP model deforms and textures correctly | ✓ (visual check, screenshot) |

**Bugs the spike caught (now fixed, and relevant to the engine)**
1. **React StrictMode stopped the animation permanently.** A cleanup-only effect (`stopAllAction`) ran on StrictMode's simulated unmount, and nothing restarted the actions. The slide meter exposed it (it read 100% of travel). **Rule for the engine:** start and stop animation actions in the *same* effect.
2. **Ankle bones give false slide readings.** During heel-lift the ankle moves while the toes are planted. Measuring with toe bones dropped the reading from 10% to 4%. **Rule:** foot-locking uses toe bones when the rig has them.

**Conclusions**
- The approach (clip time derived from distance, plus a measured speed) **works and reverses exactly**. **Adopt it.**
- **Still open:** it must be repeated with the real astronaut model once sourced. Free astronaut rigs vary in quality, and that remains the biggest asset risk.

## S3: Asset pipeline ✅ PASS (KTX2 completed after KTX-Software install)
Tool: `@gltf-transform/cli 4.5.1` via npx (not installed as a dependency).

| Variant | Size | Notes |
|---|---|---|
| Original `Soldier.glb` | 2.16 MB | 2 × 1K JPEG textures (≈ 5.6 MB GPU each); 6 unused UV channels |
| `optimize` (Meshopt + WebP, default simplify) | 0.555 MB | |
| `optimize --simplify false` | **0.557 MB (−74%)** | Mesh GPU size 800 KB → 221 KB (quantised attributes, unused UV sets pruned) |

**KTX2 results** (KTX-Software v4.4.2, signed by The Khronos Group Inc, installed per-user on 2026-11-16)

| Variant | Download | GPU texture memory |
|---|---|---|
| Original JPEG | 2.16 MB | ~11.2 MB |
| Meshopt + WebP | 0.56 MB | ~11.2 MB (WebP expands on the GPU) |
| Meshopt + KTX2 (UASTC normal, ETC1S colour) | 1.54 MB | ~2.1 MB |
| **Meshopt + KTX2 all ETC1S** | **0.64 MB** | **~1.4 MB** |

Both KTX2 variants load, keep their skin (walk speed unchanged at 1.716 m/s) and keep feet planted (max 0.54 cm/frame). **Pipeline default: ETC1S for everything; UASTC only for hero normal maps where quality shows.** The loader is configured once in `src/engine/assets/loaders.ts`.

**Findings**
- The default `simplify` step saved only about 2 KB on this skinned mesh, so it isn't worth the deformation risk. **Pipeline rule: `--simplify false` for skinned meshes.**
- Lightmap baking (the Blender part of S3) was not attempted: it needs a real room asset and the Blender decision (Q13).

## S4: Performance baseline ⚠️ LAPTOP DONE, ANDROID PENDING
Workloads: empty, procedural planet + stars, skinned character + shadow, 800/250 instanced rocks. Run at **Balanced** (2.1 MP pixel budget, bloom, one shadow-casting light) and **Low** (0.9 MP, no post-processing, no shadows). 8 s per run after 1.5 s warm-up.

**Laptop (Radeon 780M), headless Chrome, 1920×1080 viewport, 60 Hz pacing**
| Scene | Tier | Render size | p50 ms | p95 ms | p99 ms | max ms | Draw calls | Triangles |
|---|---|---|---|---|---|---|---|---|
| empty | balanced | 1920×1080 | 16.7 | 17.3 | 17.8 | 18.2 | 17 | 17 |
| empty | low | 1267×713 | 16.7 | 17.1 | 17.4 | 18.1 | 0 | 0 |
| planet | balanced | 1920×1080 | 16.7 | 17.0 | 17.4 | 20.9 | 19 | 16,145 |
| planet | low | 1267×713 | 16.7 | 16.9 | 17.5 | 22.3 | 2 | 3,968 |
| character | balanced | 1920×1080 | 16.7 | 17.0 | 17.2 | 17.5 | 23 | 22,771 |
| character | low | 1267×713 | 16.7 | 17.0 | 17.4 | 18.3 | 4 | 11,378 |
| instanced | balanced | 1920×1080 | 16.7 | 17.2 | 17.4 | 17.9 | 19 | 64,017 |
| instanced | low | 1267×713 | 16.7 | 17.3 | 17.6 | 18.4 | 2 | 20,000 |

**What this does and does not show**
- ✅ Every workload **kept 60 fps with no dropped frames** at the full Balanced pixel budget.
- ⚠️ Frame times are capped by the 60 Hz display pacing, so this shows *"keeps up"*, **not headroom**. These workloads are also much lighter than a finished scene (the room budget is 150k triangles with lightmaps). The real stress test is the P3 vertical slice.
- ⚠️ Headless frame pacing can differ from a visible window. Please also run `/spikes/?s=s4` → **Run all** in your normal Chrome window.
- **Bloom costs about 17 draw calls and 17 render targets** on its own. That is significant against the Balanced budget (≤ 150 calls); account for it.

**Finding (engine):** calling `setDpr` from inside the canvas is overwritten whenever the parent re-renders. The Low tier initially rendered at full resolution because of this. **Rule:** the quality system passes the pixel-budget DPR as the `<Canvas dpr>` prop.

**Android:** *not yet measured.*

## Other findings
- three.js r187 has deprecated `PCFSoftShadowMap`, which R3F's `shadows={true}` still selects, producing a console warning. Use `shadows="percentage"`.
- three.js warns that `THREE.Clock` is deprecated. It is used inside R3F, not our code, so no action is needed.
- **Windows path casing:** Git Bash gives Node a lowercase `c:` path, which breaks Vitest. `npm test` uses a small launcher that normalises it (documented in `scripts/vitest.ts`).

## Decisions and actions needed from you
1. ~~Install KTX-Software~~: done (not available via winget; installed from the signed official GitHub release, added to the user PATH).
2. **Run S4 on your Android phone**: run `npm run dev:lan` on the laptop, open the printed `http://<laptop-ip>:5173/spikes/?s=s4` on the phone (same Wi-Fi; allow the Windows firewall prompt), press **Run all**, then **Copy JSON** and send it to me. Also tell me the phone model.
3. **Try S1 and S2 by hand** (`/spikes/?s=s1`, `?s=s2`) with your touchpad, mouse and phone, and tell me whether scrolling feels smooth or "floaty". This decides the Lenis question.
4. **Approve P1**, then I start **P2: engine + grey-box** (director, camera system, chapter lifecycle, quality tiers, overlays, prerendered Mission Brief).
