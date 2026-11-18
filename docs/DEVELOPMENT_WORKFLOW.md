# DEVELOPMENT WORKFLOW

> How Batch 3 will be executed: one chapter at a time, each tested and **approved by you** before the next begins.

---

## 1. Phases

| Phase | Content | Exit gate |
|---|---|---|
| **P0: Setup** | git init, Vite + TS project in `c:\projects\Portfolio`, lint/format, test tooling, content module skeleton (placeholders only), CI scripts for budgets | You approve the setup |
| **P1: Spikes** (throwaway code allowed, findings recorded) | **S1** clock + scroll + GSAP/R3F sync on mobile and desktop · **S2** scroll-scrubbed skinned character with foot-locked walk, forward and reverse · **S3** asset pipeline end-to-end on one real astronaut model (Meshopt + KTX2 + baked lightmap) · **S4** performance baseline on your reference devices | A spike report with measured results and any stack adjustments; you approve |
| **P2: Engine + grey-box** | Scroll track, resolver, director, camera director, asset lifecycle, quality tiers, overlay system, Mission Brief skeleton, all proven with 3 grey-box chapters | Engine acceptance criteria (§5) |
| **P3: Vertical slice** | Origin room → door/hatch → cockpit at final quality | Slice acceptance + your creative approval |
| **P4: Chapters in story order** | One chapter per cycle (§2) | Per-chapter gate |
| **P5: Hardening** | Full-journey performance, memory, accessibility, SEO, credits page, deployment | Release checklist |

The final storyline (including the anime-inspired universe) is locked at the **start of Batch 3, before P3**.

## 2. The per-chapter cycle

1. **Brief:** restate the chapter's storyboard entry, content keys (verified content only), assets, shots and acceptance criteria. Confirm that all assets exist and are licensed.
2. **Isolated build:** develop the chapter in **isolation mode** (a dev-only URL parameter loads only this chapter with its neighbours as grey boxes), with a **dev scrubber** (slider for local t, rest-point buttons, tier switcher, aspect-class switcher, free-camera toggle).
3. **Integrate:** add the chapter to the registry; verify boundary transitions with its real neighbours.
4. **Verify:** run every check in §3; fill in the **Chapter Acceptance Report** (§6).
5. **Review:** present the report, screenshots at every rest point (desktop + portrait) and a short screen recording of forward and reverse scrubbing.
6. **Approval gate:** **stop**. The next chapter begins only after your explicit approval. Requested changes loop back to step 2.

## 3. Testing requirements

### 3.1 Unit tests (Vitest), pure logic, no rendering
- Chapter resolver: p → (chapter, localT) at boundaries, dwell zones and aspect classes.
- Scroll-length computation per aspect class; total track height.
- **Path-independence test:** for random pairs (a, b), the serialised rig state after `seek(a); seek(b)` equals the state after `seek(b)` alone. Rig state includes camera position/target/FOV, astronaut clip times and weights, ship transform, and light and effect parameters. This is the core **reverse-scroll guarantee**.
- **Monotonic sweep test:** sweeping p from 0→1 and 1→0 in small steps produces no discontinuities beyond threshold except at declared cuts.
- Walk foot-lock: clip time derived from distance is identical forward and backward.
- Content schema validation: every content key referenced by a chapter exists; no placeholder strings in production builds.

### 3.2 End-to-end tests (Playwright)
- **Scroll progression:** scroll to each rest point; assert the active chapter, overlay text visible, URL state, and focusable controls.
- **Reverse scrolling:** scroll to the end of a chapter, then back to each rest point; assert the same overlay state and **screenshot comparison** against the forward pass (tolerance threshold for GPU noise).
- **Chapter jumps:** jump from the menu to every chapter from three different starting points; assert identical results and that **no intermediate chapter's assets were requested** (network log).
- **Project Bay:** open, scroll attempt, Esc close; p restored exactly; focus returned.
- **Fallbacks:** WebGL disabled (launch flag) → Brief offered; an asset 404 (route interception) → fallback still shown and journey continues; reduced-motion emulation → photo-story mode.
- **Accessibility:** axe-core scan at each rest point and on the Brief.
- **Viewports:** desktop 1440×900, laptop 1280×720, portrait phone 390×844, landscape phone 844×390, ultrawide 2560×1080.
- *Note:* headless WebGL rendering may use software GPU paths, so screenshot tests use tolerance thresholds and run on a consistent machine. Visual sign-off still happens on real hardware.

### 3.3 Asset loading tests
- Network log per chapter: requests occur only in the prefetch window; byte totals per tier are within budget.
- Cold-cache and warm-cache runs.
- Throttled ("Fast 4G") run: no blocking stalls; fallback still appears if assets are late.
- Disposal: `renderer.info.memory` geometries/textures return to baseline ±5% after leaving a chapter.

### 3.4 Mobile responsiveness
- Every shot has portrait and landscape variants, reviewed in screenshots.
- Real-device pass on your phone: scrolling smoothness, address-bar behaviour (no jumps), touch targets, orientation change preserving progress.

### 3.5 Performance regression detection
- A dev overlay records per-chapter frame-time p50/p95, draw calls, triangles and memory to a JSON baseline file committed with each approved chapter.
- After each change, re-run on the same machine and tier. Flag regressions beyond **10%** (frame time) or any budget breach.
- Bundle-size and asset-size scripts fail the build when budgets are exceeded.

### 3.6 Visual consistency
- A **look-dev reference sheet** (created in Batch 3): colour palettes, light directions and intensities, typography scale, overlay styles, art-style profiles (realistic / anime).
- Each chapter's rest-point screenshots are reviewed side by side with its neighbours in a contact sheet before approval.
- Tone mapping, exposure and colour grading come only from the art-style profile, never per-chapter ad-hoc settings unless documented.

## 4. Definition of done (every chapter)
- [ ] Forward and reverse scrubbing are visually identical at every rest point.
- [ ] Path-independence and sweep unit tests pass.
- [ ] Chapter jump into and out of the chapter works from any position.
- [ ] Overlay text comes only from the verified content module; no placeholders.
- [ ] Portrait and landscape framings approved.
- [ ] All three quality tiers render correctly; Low tier fallback works.
- [ ] Reduced-motion version (stills + text) exists.
- [ ] Budgets met: download per tier, draw calls, triangles, frame-time p95 on reference devices.
- [ ] Memory returns to baseline after leaving.
- [ ] Keyboard and screen-reader checks pass; axe shows no violations.
- [ ] Assets recorded in the asset register with licences.
- [ ] Mission Brief section for this chapter's content updated.
- [ ] Zero React commits while scrolling within the chapter (profiler check).
- [ ] Chapter Acceptance Report submitted; **your approval received**.

## 5. Engine acceptance criteria (P2)
- Three grey-box chapters scroll forward and backward deterministically (tests green).
- Chapter jump bypasses intermediate chapters (network-verified).
- Tier switching at runtime works without reload.
- WebGL context loss is simulated (via the `WEBGL_lose_context` extension) and recovered.
- Mission Brief builds as static HTML and passes Lighthouse targets.
- Dev scrubber, isolation mode and perf overlay are functional and excluded from production builds.

## 6. Chapter Acceptance Report (template)
```
Chapter: <id> — <title>
Storyboard scenes covered: <S..>
Content keys used: <list> (all verified: yes/no)
Assets: <ids> (register complete: yes/no)
Rest points: <n> — screenshots: desktop / portrait (links)
Recording: forward + reverse scrub (link)
Tests: unit <pass/fail>, e2e <pass/fail>, axe <violations>
Performance (reference laptop, Balanced): p95 <ms>, draw calls <n>, tris <n>, download <MB>
Performance (reference phone, Low): p95 <ms>, download <MB>
Memory after exit vs. baseline: <±%>
Known issues / deviations from storyboard: <list>
Decisions needed from you: <list>
```

## 7. Working rules for Claude during Batch 3
- Load the relevant project skill before working (`.claude/skills/`).
- Never begin a new chapter without explicit approval of the previous one.
- Never edit `c:\projects\MainPortfolio\*` (the live site) unless you ask.
- Never add a dependency without stating why and what it replaces.
- Never claim "works" without the test output or a recording to show it.
- Never invent personal content; use verified entries in the content module, or stop and ask.
