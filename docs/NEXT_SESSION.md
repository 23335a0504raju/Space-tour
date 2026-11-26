# Next session: full context and tasks (updated 2026-11-25)

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
- Branch **`feat/sc11-fly-through-worlds`**, pushed to origin (github.com/23335a0504raju/Space-tour), all work
  committed. Not merged to `main` (a PR can be opened from the branch).
- Checks at hand-off: `npm run verify` 130/130, `npm run build` OK, Playwright 24/24.
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

## Remaining tasks, in order
1. SC10→SC11a join leftovers: dark inked star dots over the painted sky at t≈0.95, the tunnel's grey wall in the
   right third (anime files). (The dark band across SC11a's sky is fixed: painted dome.)
2. SC11b West Street town buildings (A049/A050 models): their textures render purple-pink and the street is flat
   orange; repaint them in the painted style (Raju's screenshot, 2026-11-25).
3. Needs Raju's approval: ink lines from depth/normals instead of luminance (`styleBlend.ts`), to clear the scratchy
   ink on detailed models (Ichiraku Ramen, the ship). Changes the line art in every anime world.
4. SC11b on Low is near budget (74/80 draw calls, 236k/250k triangles): trim before adding more there.
5. Dev-only console warning `glGetProgramiv: Program object expected` mid-journey (StrictMode + warm-up path).

## Parked until the end (content, mobile)
- Content: Spotmies end date (LinkedIn "Present" vs resume "Jun 2026"); Sports Paramount spelling; Spotmies project
  details (stack, links, what each does); approve availability/learning wording; resume PDF shows his phone number;
  emblem/initials question U13 is closed (no emblem).
- Credits still missing: HelVela II (A024) page and author, launch pad (A037), EVA suit (A039).
- Mobile layouts.
