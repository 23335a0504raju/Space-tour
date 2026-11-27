# Next session: full context and tasks (updated 2026-11-27)

## How to work with Raju (rules he has set)
- Read `CLAUDE.md` first. Load the matching `.claude/skills/` skill (r3f-scenes, cinematic-ui, scroll-cinematics,
  asset-pipeline, webgl-performance) before 3D, UI, timeline, asset or performance work.
- One fix at a time; after each, capture frames (`node scripts/capture-shots.ts <chapter>:<t,...> [--size=WxH]`
  against `npm run build` + `npx vite preview --port 4173 --strictPort`) and look at them. Run `npm run verify` and
  `npm run build` (and `npx playwright test`) before saying anything is done.
- Do the remaining tasks in order without asking for approval. Commit only when he says so. Push the feature branch
  as the repo owner: `GH_TOKEN=$(gh auth token --user 23335a0504raju) git push` (the active gh account differs).
- **Mobile is deferred** ("leave about mobile"). No phone-layout work.
- **Content is parked until the end** ("leave them, last we work on them"). Don't chase content questions now.
- The journey must feel like **one continuous spaceship flight**: no fades, flashes, torn paper or dissolves.
- He compares against dark, detailed, cinematic references (often sends an image) and is frustrated by plain results.
- **Decisions this session:** no mission emblem anywhere ("worst, don't want"; `public/emblem.svg` stays the plain
  favicon). No paper-white style stage (the style ramp inks the real scene, `src/shaders/styleBlend.ts`).
- Delete regenerable output when done (screenshots in `spike-results/`, `test-results/`); keep
  `spike-results/s4-baseline-*.json`. Do not touch his editor or other processes: stop only servers you started.
- Two Claude sessions may work here at once: agree on file ownership (SendMessage), build into your own scratchpad
  (not `dist/`), and commit only your own hunks unless he says "commit all".

## State of the repo
- Branch **`main`** (`feat/sc11-fly-through-worlds` was merged, PR #1). The 2026-11-27 work below is committed
  on `main`; check `git status -sb` for whether it has been pushed.
- Checks at hand-off: `npm run verify` 137/137, `npm run build` OK, Playwright 27 passed, 1 skipped (phone).
- Git Bash notes: no backticks or `\n` escapes inside heredoc-written scripts (write scripts with the Write tool).
  Prettier reflows long lines, so string replacements written before formatting often miss: check every edit applied.
  `active` is a reserved word in GLSL.

## Done (2026-11-25)
- **Start gate:** loader ring in a Web Worker (`src/ui/ringWorker.ts`, `ringLoop.ts`, `ringHost.ts`; StrictMode-safe),
  critical-first preload (`CRITICAL_ASSETS`), title waits for the first smooth frames. No freezes after the title.
- **Chapter-entry freezes:** warm compile in an empty stage scene with the chapter's environment, for every output the
  tier may draw to (`src/engine/assets/warm.ts`); probe `node scripts/measure-freezes.ts [--low] [--why]`.
- **SC13 ending:** the camera lifts to the Moon; the contact card ("Lunar Gravity" reference) with the Moon, dust ring
  and rocks (`src/chapters/homecoming/LunarMoon.tsx`, `src/shaders/lunarRing.ts`); fits any window without a
  scrollbar (container queries). Header Contact flies there.
- **Mission Brief** redesigned in the journey's visual language (`src/brief/`).
- **Earth close-ups** (SC12/SC13): clouds, limb-only haze, 4K map (`createEarthMaterial(…, { closeup: true })`).
- **SC10 look back:** Venus/Uranus/Neptune textured (A051–A053, CC BY 4.0, credited); Uranus tilted with rings; the
  Sun rebuilt after Raju's reference (`src/shaders/sun.ts`); orbit lines fade over the Sun.
- **Anime worlds** (other session): painted cumulus clouds (`PaintedPuffs`, `Clouds`), painted sky domes and
  mountain ranges (`PaintedRange`), clustered painted trees, Japanese facades and tiled roofs on the village houses
  (`paintVillage` in `anime/world.tsx`), flat vermilion gates, painted motes, cloud-deck fade, `PaintedSun`
  (no halo in SC10), smooth ringed planet. All in `src/chapters/anime/`. Painted surfaces mark themselves in the
  alpha channel (`PAINTED_BLEND`, constant 0.5) and the style pass skips ink and posterising for them.
- Performance sweep, every chapter at its rest points: 60 fps both tiers; draw calls ≤122 Balanced / ≤74 Low;
  triangles ≤416k / ≤236k (all within budget).

## Done (2026-11-27)
- **Purple-pink anime worlds (root cause):** the style pass swapped every dark pixel for its painted sky and
  crushed anything under 0.125 luminance to black. Chapters now say when dark means open space (`backdrop(t)`,
  default 0; only SC10 uses it) and drawn darks keep their colour on a violet shadow floor. SC10 leaves its
  background empty once painted (`emptyBackground(t)`), so the sky no longer depends on that rule at the join.
- **West Street (SC11b) repainted:** frontier palette per material (`recolor` in `scripts/optimize-anime.ts`) and a
  self-lit painted material (`src/chapters/anime/painted.ts`): cel light, planks, shingle rows, dirt street with ruts.
- SC10→SC11a leftovers (star dots at t≈0.95, tunnel wall) were fixed in `caa6f8e`; checked in frames.
- **World titles:** each anime world opens with its series name floating in the sky, in flight order
  (`src/chapters/anime/titles.tsx`, an overlay at local t 0.22). Our own SVG lettering with the site's and system
  fonts: Raju sent the official logos as the reference; they are not shipped (not free to use).
- **Cards fit the window:** desktop cards scale down (`--fit`, `src/ui/fitCards.ts`) instead of scrolling inside
  themselves, and stay between the header and the bottom bar. Checked 1180x620, 1280x720, 1536x730, 1920x950.

## Remaining tasks, in order
1. Small: star dots still show over the sky around SC10 t≈0.86, while the cel colour is coming in.
2. Anime models still look dull or scratchy next to the painted town: SC11c farm tiles (animals, fences), Ichiraku
   Ramen, the ship. The painted material could take the farm; ink is task 3.
3. Needs Raju's approval: ink lines from depth/normals instead of luminance (`styleBlend.ts`), to clear the scratchy
   ink on detailed models (Ichiraku Ramen, the ship). Changes the line art in every anime world.
4. SC11b on Low is near budget (draw calls ~74/80, 236k/250k triangles): trim before adding more there.
5. Dev-only console warning `glGetProgramiv: Program object expected` mid-journey (StrictMode + warm-up path).

## Parked until the end (content, mobile)
- Content: Spotmies end date (LinkedIn "Present" vs resume "Jun 2026"); Sports Paramount spelling; Spotmies project
  details (stack, links, what each does); approve availability/learning wording; resume PDF shows his phone number;
  emblem/initials question U13 is closed (no emblem).
- Credits still missing: HelVela II (A024) page and author, launch pad (A037), EVA suit (A039).
- Mobile layouts.
