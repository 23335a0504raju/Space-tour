# raju-codes.me: cinematic mission portfolio

A scroll-directed 3D journey (room → spacecraft → solar system → anime-inspired universe → home) presenting Raju Chowdavada's work, plus **Mission Brief**: a lightweight, accessible version with the same content.

> **Status:** Phase **P0: project setup**. No 3D yet. See `docs/DEVELOPMENT_WORKFLOW.md`.

## Commands

| Command                  | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `npm run dev`            | Dev server: journey at `/`, Mission Brief at `/brief/`                |
| `npm run build`          | Type-check and build both pages to `dist/`                            |
| `npm run preview`        | Serve the production build                                            |
| `npm run verify`         | Typecheck + lint + format check + unit tests                          |
| `npm test`               | Unit tests (Vitest)                                                   |
| `npm run test:e2e`       | Playwright smoke tests (first run: `npx playwright install chromium`) |
| `npm run content:report` | List every content fact that isn't confirmed yet                      |
| `npm run content:check`  | Same, but fails if anything is unconfirmed (release gate)             |

## Where things live

| Path                       | What                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/content/`             | **Single source of truth** for all personal content. Each value is a `Fact` with status and source. |
| `src/chapters/registry.ts` | The ordered journey (scene codes from `docs/FINAL_STORYLINE.md`)                                    |
| `src/engine/`              | Engine code (scroll resolver now; director, camera, assets, quality in P2)                          |
| `src/app/`                 | Journey page (SC01 shell for now)                                                                   |
| `src/brief/`               | Mission Brief page                                                                                  |
| `src/ui/`                  | Shared UI (contact panel, fact rendering)                                                           |
| `src/styles/`              | Design tokens and base CSS                                                                          |
| `assets/ASSET_REGISTER.md` | Licence register for every shipped asset                                                            |
| `docs/`                    | Planning documents (Batches 1–3)                                                                    |
| `.claude/skills/`          | Project skills for Claude Code                                                                      |

## Content rules

- Never hard-code personal information in components. Add it to `src/content/` with its source.
- Statuses: `confirmed`, `source`, `conflict`, `unverified`, `missing`.
  - `missing` facts (templates) are **never rendered in production**.
  - In development, unconfirmed facts are underlined in orange; hover to see why.

## Stack

Vite 8 · React 19 · TypeScript 6.0 · Three.js · React Three Fiber · Drei · GSAP + ScrollTrigger · Zustand · CSS Modules. Hosted on Vercel.
TypeScript is pinned to 6.0.x because `typescript-eslint` does not yet support TypeScript 7.
