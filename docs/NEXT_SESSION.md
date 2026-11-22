# Next session: full context and tasks (updated 2026-11-22, end of session)

## How to work with Raju (rules he has set)
- Read `CLAUDE.md` first. Load the matching `.claude/skills/` skill (r3f-scenes, cinematic-ui, scroll-cinematics,
  asset-pipeline, webgl-performance) before 3D, UI, timeline, asset or performance work.
- One fix at a time; after each, capture frames (`node scripts/capture-shots.ts <chapter>:<t,...>` against
  `npm run build` + `npx vite preview --port 4173 --strictPort`) and show them. Run `npm run verify` and `npm run build`
  (and `npx playwright test` with the preview server stopped) before saying anything is done.
- He said: **do the remaining items in order without asking for approval.** Do NOT commit until he says so. Push as
  the personal account: `GH_TOKEN=$(gh auth token --user 23335a0504raju) git push origin main`.
- **Mobile responsiveness is deferred** ("we can work on it later"). Do not spend time on phone layouts.
- He wants the journey to feel like **one continuous spaceship flight, not screen switching**: no fades, flashes,
  torn-paper or dissolves between chapters (all removed). Only the loader opening burns open.
- He compares against reference images (dark, detailed, cinematic) and gets frustrated when results look plain.

## State of the repo
- Branch `main`, last commit `e9b7353`. **Everything below is uncommitted** (large diff).
- Checks at hand-off: `npm run verify` 122/122, `npm run build` OK, `npx playwright test` 24/24 (the phone
  "contact sheet" smoke test sometimes fails in the full run, passes alone: a load flake).
- Git Bash notes: no backticks inside `node -e`; write edit scripts to files. **Prettier reflows long lines, so
  string replacements written before formatting often miss: check the edit applied.** A killed preview leaves a child
  node process on port 4173: stop it before Playwright (find the PID with Get-NetTCPConnection).

## Done this session (all uncommitted)
1. **Loader/opening (task 8)**: `src/ui/StartGate.tsx`, `src/ui/shardRing.ts`, `StartGate.module.css`. Dark page, guide
   lines, tilted ring of shards/sparkles assembles with the real download fraction around the name; scrolling (or Begin)
   ignites a spark that burns an organic hole outward (scene appears in fragments along a thick fibrous white edge, 3
   burn spots merge), reversible; reduced-motion path. 2D canvas at 1x density (no second WebGL).
2. **Loader lag fixes**: no throwaway WebGL probe (`engine/quality/detect.ts`), progressive sky bake
   (`chapters/space/DeepSky.tsx`), `FirstFrame` precompile + `sceneShown` store flag (`engine/journey/Journey.tsx`,
   `engine/store.ts`), `engine/assets/warm.ts` (compile + shader keepers). Ready in ~2-3 s on the laptop, 60 fps title.
3. **Scroll feel**: one smoothing layer (`engine/scroll/pacing.ts` ease 0.11, no speed cap, `scrub: true` in
   `useScrollMaster`). Matches Shopify's Lenis feel. Chapter-entry freezes halved but NOT gone (see tasks).
4. **Transitions**: torn paper and dissolves were built, tested and then fully removed (Raju wants continuous flight).
5. **Continuous flight joins** (shared module `src/chapters/handoff.ts`; test `src/chapters/handoff.test.ts` checks every
   join): SC05→06 (orbit insertion, shared flight sky `chapters/space/skyFrame.ts`), SC06→07, SC07→08 (Jupiter ahead),
   SC08→09 (Saturn ahead), SC09→10 (distant black hole), SC03→04 (lift door `room/LiftDoor.tsx`, `cockpit/arrival.ts`,
   astronaut steps out and sits), SC04→05 (camera flies out of the windscreen, SC05 opens there), anime worlds
   SC11a→b→c (sky/light blend, landmarks scale in/out, `anime/anime.ts` skyMix/markScale), SC11c→SC12 (same ringed
   planet), SC12→SC13 (same Earth and camera). SC10→SC11a was already designed to flow (unchanged, recheck it).
6. **SC10 look back** (`crossing/solarSystem.ts`, `SolarSystem.tsx`): after Saturn the camera looks back at the Sun
   (clearly visible disc + glow) and all 8 planets with orbit lines (one ecliptic plane), lit from the Sun. Venus,
   Uranus, Neptune are procedural for now (no NASA maps yet).
7. **Anime worlds first pass (task 7)**: 9 models converted by `node scripts/optimize-anime.ts` (about 7 MB total, KTX2 +
   Meshopt, skinned ones keep their skeleton) into `public/assets/models/anime_*.glb`, loaded by
   `chapters/anime/AnimeModel.tsx`, placed in `anime/areas.tsx`; preload list updated; registered as A040-A048 in
   `assets/ASSET_REGISTER.md`; CC-BY credits in the Mission Brief footer (`src/brief/Brief.tsx`).
   Mapping: SC11a Discipline = Naruto (ramen shop + Naruto figure), SC11b Proof = Death Note (Kinnaird House, Ryuk,
   Death Note), SC11c Horizon = Demon Slayer (farm, Tanjiro, Nezuko, blossom katana).

## Tasks, in order
1. **Anime worlds are plain and do not read as places (Raju's latest complaint, checked: he is right).** Each world is a
   flat pastel gradient with 2-3 small floating islands; characters are 9-20 m beside a 60 m ship, in T-pose (the files
   have no clips); no ground, no village, no street, no horizon. West Street (963k tris, needs heavy decimation) and
   the Rural Buildings Set are unused. Rebuild each world as a recognisable place: a ground/cloud-sea tier, dense
   clusters (instance the rural buildings set; decimate West Street into a street strip; Kinnaird as the anchor),
   characters scaled 25-40 m or placed much nearer the flight line, landmarks the camera dwells on at the rest points
   (overlay panels sit opposite: right, left, right), more depth layers and parallax, atmosphere per world. Consider
   posing the T-pose characters (retarget Mixamo clips on the Y Bot is NOT possible for these rigs: either pose bones
   by code or pick a stronger static silhouette). World details are still open: ask Raju for what each world must show.
2. **Cockpit backdrop vs SC05**: the windscreen view (`cockpit/Cockpit.tsx` `TowerView`) is a starry night with the
   Milky Way; SC05 opens in purple dusk. Make the cockpit view use SC05's sky and tower so the SC04→SC05 join matches.
3. **Chapter-entry freezes (0.5-2.2 s) when a chapter first becomes active** (scrolling through the whole journey):
   shaders are keyed to lights/shadow state of the active chapter and cannot be fully compiled while hidden. Plan:
   briefly activate each chapter in its real on-screen state behind the loader (cover is opaque), or merge program
   variants. Measure with the scripts' approach: long frames vs scrollY; `getProgramInfoLog` dominates.
4. **Task 5 part 3**: the last Earth view (SC12 Return / SC13 Homecoming) looks flat: add terminator depth, a cloud
   layer, and the limb atmosphere matching SC06 (`shaders/earth.ts` createEarthMaterial / createLimbAtmosphereMaterial).
5. **Task 6 finish**: NASA/public-domain maps for Venus, Uranus, Neptune (and rings for Uranus), register them
   (A049+), KTX2; replace the procedural ones in `crossing/SolarSystem.tsx`.
6. Loader leftovers: one ~1 s stall remains when the first scene's shaders link behind the cover; verify on his Android.
7. SC10→SC11a join: re-check it flows (black hole into the painted world, same camera and sky).
8. Docs: update `CLAUDE.md` "Current phase" and the plan docs for the continuous-flight design; commit only when Raju
   says so.

## Still needs Raju
- Resume URL (Q5), CGPA 8.31 or 8.36 (Q2), HelVela II (A024) page and author, launch pad credit (A037: Lezalit or
  Kerem Kavalci), EVA suit (A039) page and author, phone model (Q12), his own copy for SC05, SC10 and SC12, and the
  anime world details (what each world should show).
