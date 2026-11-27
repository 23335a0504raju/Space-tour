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
- Branch **`main`**: `feat/anime-worlds-voyage` merged and pushed on Raju's word (2026-11-27).
- Checks at that merge: `npm run verify` 145/145, `npm run build` OK, Playwright 27 passed, 1 skipped (phone).
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

## Done (2026-11-27, anime worlds)
- **SC11a is the whole Hidden Leaf village** (A054, `anime_village.glb`, one draw call): turned 45° and scaled 160 so
  the main street runs down the flight line to the Hokage tower and the stone faces (`layout.ts` `VILLAGE`),
  painted from its own atlas (`painted.ts` `paintedAtlas`), forest round the island. The procedural houses, torii,
  tower, Ichiraku Ramen (A041) and the old Naruto (A040) are gone.
- **Cast** (A055–A060): Naruto (sage), Jiraiya, Itachi, Pain, Obito on the village street; Tanjiro, Nezuko, Inosuke on
  the farm road; Ryuk and the notebook in the town street. **Raju: nobody floats** — everyone stands on solid ground,
  in a natural pose (tested in `layout.test.ts`). A-pose / T-pose rigs are posed by `optimize-anime.ts`.
- **World-to-world travel** (`voyage.ts` pure and tested, `Voyage.tsx`): each world sinks under its planet's clouds,
  the planet falls away as a globe, stars and streaks, the next planet grows ahead, the next world rises out of it.
  Replaces the cloud sea and the sky blend. SC11 chapters are 1.65 screens.
- Checks: verify 145/145, build OK, Playwright 27 passed, 1 skipped; 60 fps both tiers (Balanced ≤104 draw calls,
  ≤368k triangles; Low ≤74 / ≤236k). Entry hitches (`measure-freezes`): SC11a ~83 ms (was ~33 before this work),
  SC11b ~50–67 ms, SC11c ~100–117 ms (was ~167); none over 250 ms.
- **Ink lines from scene depth** (`styleBlend.ts`, `lens.ts`; a chapter may ask for colour ink with `colourInk(t)`,
  SC12's tunnel does): outlines and raised corners instead of texture noise. The checks and frames above include it.

## Done (2026-11-27, after the first push)
- SC10: the space stars fade out before the colour comes in (`spaceSkyAt`), no dark dots on the painted sky.
- SC11c farm: it looked broken, not only dull. Simplifying had eaten the pine crowns, roof ridges and windmill
  blades, and ETC1S blended its tiny colour swatches (green came out straw). Now repainted (`FARM_SWATCHES`),
  UASTC, painted from its own colours (`AnimeModel` `finish="own"`), full detail on Balanced and the 25k copy
  (`anime_farm_lo.glb`) on Low. Brighter farmland round it.
- SC11b within the plan's Low budget: 58 draw calls, 194k triangles (was 74 / 236k): lighter Kinnaird House and 10
  rural buildings on Low; the notebook prop is 1.2k triangles on both tiers.

## Done (2026-11-27, cards and Spotmies)
- Raju: cards were huge and the site showed little. Cards are narrower with compact type (`overlays.module.css`) and
  see-through (Balanced: 44% tint over dimmed, blurred scene; Low: 76% tint).
- New Crew Record card "Work at Spotmies LLP" (`src/chapters/WorkCard.tsx`, SC04 rest 0.525, SC04 2.5 screens): the
  four projects and three results already in `src/content/experience.ts`.
- LinkedIn was not re-read (needs his login); the content is from the 2026-11-24 read. Ask him to paste the Experience
  and About text for anything newer.

## Remaining tasks, in order
1. Review the line art (ink from depth) in SC10-SC12 with Raju.
2. The farm on Low still uses the simplified copy (thin trees and ridges): a better low variant if it matters.
3. Dev-only console warning `glGetProgramiv: Program object expected` after a cold jump into SC11: no JS-side query
   of a deleted program exists, and adding synchronous `getError` probes makes it vanish, so it is a timing quirk
   inside the browser's GL layer. Not seen to affect anything; left as is.
4. Entry hitches ~80-120 ms as SC11a and SC11c warm up (none over 250 ms).

## Parked until the end (content, mobile)
- Content: Spotmies end date (LinkedIn "Present" vs resume "Jun 2026"); Sports Paramount spelling; Spotmies project
  details (stack, links, what each does); approve availability/learning wording; resume PDF shows his phone number;
  emblem/initials question U13 is closed (no emblem).
- Credits still missing: HelVela II (A024) page and author, launch pad (A037), EVA suit (A039).
- Mobile layouts.
