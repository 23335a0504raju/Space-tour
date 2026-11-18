# BATCH 2 SUMMARY

> Status: **complete, awaiting your approval.** No dependencies installed, no application code written, nothing in `c:\projects\MainPortfolio` modified.

## 1. Deliverables
| File | Purpose |
|---|---|
| `docs/WORKSPACE_REPORT.md` | What exists, what to retain, improve or replace, plus findings (including a security issue) |
| `docs/STACK_DECISIONS.md` | Technology analysis, official references, rejected alternatives |
| `docs/TECHNICAL_BLUEPRINT.md` | Architecture: chapter contract, scroll/timeline, camera, character, ship, loading, overlays, Brief, errors |
| `docs/ASSET_PIPELINE.md` | Asset classification, Blender workflow, optimisation, licensing |
| `docs/PERFORMANCE_ACCESSIBILITY.md` | Device classes, three quality tiers, measurable targets, accessibility |
| `docs/DEVELOPMENT_WORKFLOW.md` | Phases, spikes, per-chapter cycle, tests, acceptance report, approval gates |
| `.claude/skills/r3f-scenes/` | 3D scenes, camera, lighting, models, art styles |
| `.claude/skills/scroll-cinematics/` | GSAP/ScrollTrigger timelines, reversibility, jumps |
| `.claude/skills/asset-pipeline/` | Sourcing, Blender, optimisation, register |
| `.claude/skills/webgl-performance/` | Budgets, tiers, memory, profiling |
| `.claude/skills/cinematic-ui/` | Typography, overlays, navigation, accessibility, Mission Brief |
| `.claude/skills/chapter-workflow/` | The approval-gated chapter cycle (`/chapter-workflow <id>`) |

## 2. Key decisions (recommended, pending approval)
1. **Build fresh in `c:\projects\Portfolio`**, with Vite 8 + React 19 + TypeScript. The existing CRA site stays live and untouched until the new one is approved.
2. **Runtime stack:** three.js (WebGL2), React Three Fiber v9, drei (selective), pmndrs postprocessing, GSAP + ScrollTrigger, and Zustand. Nothing else.
3. **One clock, one progress value, one animation system.** GSAP drives everything (3D and DOM), with timelines seeked from scroll. No framer-motion, no drei ScrollControls, no Spline.
4. **No Lenis at first.** Native scroll plus ScrollTrigger numeric `scrub` gives a single smoothing layer. Lenis is a reversible option if testing shows a need, and it would be used with `scrub: true`, never both.
5. **Determinism:** story state is a pure function of progress, so reverse scrolling and chapter jumps are exact. Ambient motion is separated out.
6. **Chapter contract and registry:** new destinations (including anime-universe chapters) plug in without engine rewrites. **Art-style profiles** allow a realistic-to-anime style switch.
7. **Assets:** GLB + Meshopt (Draco only when measured better) + KTX2, optimised with glTF-Transform; Blender for clean-up, lightmap baking and retarget fixes. Every asset is recorded in an asset register with its licence.
8. **Mission Brief:** a separate, statically prerendered page from the same content module. It works without WebGL or JavaScript.
9. **Quality tiers** High / Balanced / Low, with heuristics plus `PerformanceMonitor` step-down and a manual override.
10. **Workflow:** P0 setup → P1 four spikes → P2 engine + grey-box → P3 vertical slice → P4 chapters one by one, each with an acceptance report and your approval.

## 3. Biggest technical risks
| Risk | Why | Mitigation |
|---|---|---|
| Astronaut quality and animation | The single most "fakeable-looking" element; free models vary widely | Spike S2/S3 with a real model before committing; faceless suit; cuts instead of bespoke animation |
| Mobile GPU memory (iOS) | Planet textures and panoramas are large | KTX2 everywhere, strict per-tier texture budget, one WebGL context |
| Scroll/clock integration on mobile | Address bar, momentum and Safari frame caps | Spike S1 on your real phone first |
| Scope and length | 19 storyboard scenes plus the new anime universe | Vertical slice first; trim list in `TECHNICAL_FEASIBILITY.md` §9 |
| Visual consistency across realistic and anime styles | Two art directions in one film | Art-style profiles, plus a diegetic transition (see §4) |
| Anime-universe art | Painted backgrounds and original designs are professional work | Lean on shader-based stylisation; decide on sourcing/commission in Batch 3 |
| Testing WebGL headlessly | Software rendering differs from real GPUs | Tolerance thresholds; real-device sign-off in every gate |

## 4. Conflicts with Batch 1 (identified, not silently changed)
1. **Anime universe vs. "The Unbuilt" (R17) and the restrained realistic style (constraint 3).** A realistic film that switches to anime style risks feeling like two products.
   - *Proposal for Batch 3 (not decided):* keep the wormhole as the art-style boundary. "The Unbuilt" can become *how* the anime universe appears: wireframe → ink line art → cel-shaded colour. This merges both ideas into one meaningful transition.
2. **Merged ending (R18).** Where the final transmission happens (inside the anime universe or after it) must be re-decided in Batch 3.
3. **Batch 1 project list vs. existing data.** MeraSports / Sports Paramount and Arcslot aren't in your current portfolio, while seven other projects are. The project tiers (R14/R15) can't be finalised until you confirm the list.
4. **Runtime target (R22, 3–4 minutes).** Adding the anime universe will push the length up unless other scenes are trimmed.

## 5. What must be prepared before Batch 3
**From you:**
- [ ] Approve or adjust this batch's decisions (§2).
- [ ] Resolve the `.env` security issue in the `port` repo (see `WORKSPACE_REPORT.md` §3).
- [ ] Tell me where the "separate personal information folder" is. It wasn't found; your data is currently inside `port/src/components/*.jsx`.
- [ ] Verify the content: the final project list (including MeraSports/Sports Paramount and Arcslot facts), internships, education, certifications, and which achievements are accurate.
- [ ] Provide a resume PDF.
- [ ] Name your reference devices (laptop + phone) and say whether you have access to a Mac (for iOS profiling).
- [ ] Answer the Batch 1 production questions: Blender comfort level, asset budget (free only?), timeline.
- [ ] Choose a hosting target (current host unknown) and confirm that the domain `raju-codes.me` will move to the new site.
- [ ] Approve `git init` in `c:\projects\Portfolio`, and where `.blend` source files live (outside the repo vs. Git LFS).

**From me at the start of Batch 3:**
- Lock the final storyline, including the anime-inspired universe.
- Run P0 setup, then spikes S1–S4 with a measured report, before any real chapter.

## 6. Unresolved technical questions requiring your approval
| # | Question | My recommendation |
|---|---|---|
| T1 | New project in `c:\projects\Portfolio` vs. rebuilding inside `port` | New project |
| T2 | TypeScript 7 vs. 6.x | TS 7 if lint tooling supports it at install time, otherwise 6.x |
| T3 | Lenis now or only if needed | Only if needed |
| T4 | CSS approach: plain CSS modules + tokens vs. Tailwind 4 | CSS modules + tokens (bespoke cinematic UI), but Tailwind is fine if you prefer it |
| T5 | Optional audio (ambient score) | Opt-in, off by default; decide sourcing in Batch 3 |
| T6 | Any analytics or error telemetry | None by default; privacy-friendly analytics only if you want it |
| T7 | Hosting provider | Any static host with custom headers (correct MIME types for `.ktx2`/`.glb` and immutable caching) |
| T8 | Commissioning art for the anime universe vs. shader-only stylisation | Decide after the Batch 3 storyline |
| T9 | Free assets only, or a small paid budget for the astronaut and ship | Free first; paid only if spike S3 shows free options are inadequate |
