# Project rules for Claude Code

- **Plan of record:** `docs/FINAL_STORYLINE.md`, `docs/TECHNICAL_BLUEPRINT.md`, `docs/DEVELOPMENT_WORKFLOW.md`. Superseded Batch 1 sections are marked `[SUPERSEDED B3]`.
- **Current phase (2026-11-25):** all 13 chapters built; P5 polish. The journey is **one continuous spaceship flight**: chapters join through shared camera/sky/planet handoffs (`src/chapters/handoff.ts`), never fades, flashes or dissolves. Mobile layouts and content gaps are parked until last (user decision). Open items and their order: `docs/NEXT_SESSION.md`.
  - Start gate: the loader ring draws in a Web Worker (`src/ui/ringWorker.ts`, `ringLoop.ts`, `ringHost.ts`); only the first scenes' files (`CRITICAL_ASSETS` in `src/engine/assets/preload.ts`) gate the title, the rest download in the background.
  - Chapter warm-up (`src/engine/assets/warm.ts`): compile in an empty stage scene with the chapter's own environment, for every output the tier may draw to. Probe entry freezes with `node scripts/measure-freezes.ts [--low] [--why]`.
  - SC13 ends on the contact card with the Moon (`src/chapters/homecoming/LunarMoon.tsx`, `src/shaders/lunarRing.ts`); header Contact flies there. SC12/SC13 Earth uses `createEarthMaterial(…, { closeup: true })` (clouds, limb-only haze). The Mission Brief (`src/brief/`) shares the journey's visual language.
  - Ship: the user-supplied HelVela II (`src/chapters/ship/HelVela.tsx`, `npm run assets:ship`); A024 still needs the Sketchfab URL + author. The astronaut stays the Mixamo Y Bot (user decision: do not replace it); `src/chapters/astronaut/Astronaut.tsx`, chapters pass a pure `Drive`; re-convert with `npm run assets:mixamo`. Wheel pacing: `src/engine/scroll/pacing.ts`. Planet maps: `npm run assets:nasa` (keeps existing outputs; `--force` re-encodes).
  - Rendering lessons: `.claude/skills/r3f-scenes/SKILL.md`. Review frames with `node scripts/capture-shots.ts <chapter>:<t,...> [--perf] [--low] [--portrait] [--size=WxH]` against `npm run preview` (`--perf` also prints draw calls, triangles and live GPU textures/buffers).
  - Two Claude sessions may share this folder: build into your own scratchpad (not `dist/`), agree on file ownership first, and never commit another session's files without the user's go-ahead.
- **Personal content** lives only in `src/content/`, as `Fact` values with a source. Never invent experience, metrics, achievements, responsibilities or links. Unknowns use `missing(...)` templates.
- **Never modify** `c:\projects\MainPortfolio\` (the live site; read-only source of truth).
- **Animation law:** one clock, one progress value, one animation system (GSAP). Story state is a pure function of scroll progress, so reverse scrolling is exact. No `setState` in frame or scroll loops.
- **Assets:** free only, registered in `assets/ASSET_REGISTER.md` before committing. `.blend` and raw sources stay outside the repo.
- **Hardware reality:** Radeon 780M laptop plus an Android phone. Respect `docs/PERFORMANCE_AND_ACCESSIBILITY_PLAN.md` budgets.
- **Before claiming done:** run `npm run verify` and `npm run build`, and report the actual output.
- Load the matching skill in `.claude/skills/` before 3D, timeline, UI, asset or performance work.
