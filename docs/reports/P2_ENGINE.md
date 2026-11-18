# P2 Report: Engine + Grey-box Journey

> Date: 2026-11-16 · Status: **awaiting your review**
> **What "grey-box" means:** simple stand-in shapes in the right places, so story, timing, camera and engine can be judged before real 3D assets exist. Every scene is replaced by real assets in P3/P4 without changing the engine.

## What you can see now
`npm run dev` → **http://localhost:5173/** (the main page; no longer the old placeholder).
In dev, unconfirmed content is underlined in orange (hover for the reason). Production builds hide templates and show no markers.

| Scroll | Scene | Your content shown |
|---|---|---|
| 0–4% | SC02 Room (ship visible through the window) | Name, role |
| 4–10% | SC03 Departure (stand → walk → door → white-out) | Summary |
| 10–17% | SC04 Cockpit | **Spotmies + Pit Solutions experience**, then education |
| 17–21% | SC05 Ascent (liftoff, cloud layers, sky to black) | — |
| 21–28% | SC06 Orbital sunrise (Earth, Moon, rising Sun) | Core strengths (spectrum) |
| 28–36% | SC07 Moon pass → Mars → asteroid belt | Supporting projects |
| 36–48% | SC08 Jupiter + 3 stations | SmartWay Traffic, DocumentDB, Stash |
| 48–54% | SC09 Saturn (rings light up band by band) | Technology stack |
| 54–60% | SC10 Gate → space redrawn as ink on paper | — |
| 60–82% | SC11 A/B/C anime-style areas (toon shading, outlines) | Certifications, achievements, what's next |
| 82–87% | SC12 Return to real space | — |
| 87–100% | SC13 Home above Earth, beacon | Contact panel (stays to the end) |

Always available: **Projects** (jumps to Jupiter), **Contact** (instant sheet), **Mission Brief**, **Flight plan** menu (jump to any chapter + High/Low quality), progress bar with chapter name, ←/→ to step between rest points.

## Engine delivered
| Part | File(s) |
|---|---|
| Chapter contract + registry + implementations | `src/chapters/contract.ts`, `registry.ts`, `implementations.ts` |
| Director (one tick → camera, scene visibility, overlays, dip, progress) | `src/engine/director/Director.tsx` |
| Keyframed camera shots, portrait FOV widening | `src/engine/camera/shots.ts` |
| Lifecycle: active ±1 chapters mounted, shaders precompiled while hidden | `src/engine/journey/Journey.tsx` (`ChapterSlot`) |
| Quality tiers: device heuristics + manual override; pixel budget owns `<Canvas dpr>` | `src/engine/quality/*` |
| Overlays: real DOM text at rest points; hidden ones `inert` + `aria-hidden` | `src/chapters/overlays.tsx` |
| Fallbacks: no WebGL2 → Brief + contact; context lost → notice; reduced motion → notice | `Journey.tsx` |
| KTX2 + Meshopt loader (configured once) | `src/engine/assets/loaders.ts` |
| **Mission Brief prerendered to static HTML** (works without JavaScript; CSS class names verified at build) | `src/brief/entry-server.tsx`, `scripts/prerender-brief.ts` |

## Verification (measured)
| Check | Result |
|---|---|
| `npm run verify` (typecheck, lint, format, unit tests) | ✅ 45/45 unit tests |
| `npm run build` | ✅ includes the Brief prerender (13.3 KB HTML, 34 classes verified) |
| `npm run test:e2e` (production build, installed Chrome, desktop 1440×900 + Pixel 7 portrait) | ✅ **18/18** |
| Every rest point shows its content; screenshots in `spike-results/journey/` | ✅ |
| Flight-plan jump and header Projects jump | ✅ |
| Mission Brief with JavaScript disabled | ✅ |
| axe accessibility scan, journey + Brief, both viewports | ✅ 0 violations |
| Console errors | ✅ none (only three.js's own `THREE.Clock` deprecation warning from inside R3F) |

## Bugs found and fixed during P2
1. **Infinite render loop (React error #185)**: `useScrollMaster` returned a new object each render, so the navigate callback re-registered in the store endlessly. Fixed by memoising; the page rendered nothing before the fix. Found by the e2e suite.
2. **Name clipped on SC02**, **camera inside the astronaut on SC04**, **header text unreadable over pale anime skies**, **unlit ship + oversized pulse on SC13**: found by reviewing the screenshots, all fixed and re-checked.
3. **Skip link outside a landmark** (axe): moved into the header.

## Known gaps (honest list)
- **Initial JS ≈ 377 KB gzipped**, over the 350 KB target (three.js + R3F + GSAP + React). Code-split and trim in P5.
- **Not yet measured on your Android phone.** Please run S4 (see `P1_SPIKES.md`) and try the journey on the phone: `npm run dev:lan`.
- **Lenis decision** still needs your hands-on feel test (touchpad / mouse / phone).
- Grey-box visuals only. The reduced-motion photo-story mode, Project Bay, sound and the mission emblem design come later.
- Chapter-change announcements are polite and short. A full screen-reader pass (NVDA) has not been done yet.

## Next (needs your approval)
**P3: vertical slice.** SC02 Room → SC03 Departure → SC04 Cockpit at final quality: source free room, astronaut and cockpit assets (licences checked and registered), run them through the KTX2 pipeline, and replace the grey boxes.
