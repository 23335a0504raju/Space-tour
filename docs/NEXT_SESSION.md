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
- Latest checks (2026-11-27, after the cards, phone and stand-up work): `npm run verify` 147/147, `npm run build` OK,
  Playwright 28 passed, 2 skipped (one desktop-only, one phone-only). `measure-freezes` Balanced: 0.1 s in hitches
  over the whole journey (was 0.8 s), worst 67 ms.
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

## Done (2026-11-27, cards, phone and stand-up)
- **Cards animate in again** (Raju: they popped in). The scroll still decides whether a card shows; the entrance then
  takes `CARD_IN_S` 0.9 s and the exit 0.35 s (`overlayMath.ts` `easeVisibility`, unit-tested).
- **Stand-up stutter:** dressing each astronaut raycast the skinned mesh for ~90 ms per chapter (results now cached per
  geometry, `suit.ts`); three's shader error checks are off in production (`Journey.tsx` `onCreated`); SC03 has no
  dwell (it slowed time mid stand-up and has no card). Left: ~60-150 ms hitches while the cockpit and ascent mount and
  compile in the background.
- Loose parts of the removed bridge seat no longer hang round the astronaut's legs (`scripts/optimize-bridge.ts`).
- **Phones** (Raju asked): cards are bottom sheets at most 52% tall, never scroll containers, so a swipe on a card moves
  the page; compact type, fitted by `fitCards.ts`. Playwright covers it (`journey.spec.ts`).

- **Cards more see-through on every screen** (Raju): Balanced 24% tint over a dimmed, lightly blurred scene; Low 58%.
  Over the brightest skies the small grey text is the weakest: keep an eye on contrast before lightening further.
- **One Sun** (Raju): SC06's sunrise now shows the same star as SC10's look back (`src/chapters/space/SunStar.tsx`).

## Done (2026-11-28, Raju's photo and courses)
- Raju asked for his picture in the portfolio and supplied the photo (A061, A062, `scripts/prepare-portraits.ts`, raw
  file in `raw-assets/me/`). Shown on: the desk (SC02/SC03) as a hologram, the Experience crew record (SC04) and the
  Mission Brief header (`identity.portrait`, `ui/Portrait.tsx`).
- **Not on the final contact card** (Raju: "don't show the image of me" there, after trying a round portrait and a
  waist-up figure). The surname on that card was nearly invisible (inherited text shadow under the gradient): fixed.
- The hologram (`room/Hologram.tsx`, `shaders/faceHologram.ts`, `shaders/projector.ts`), after Raju's written brief:
  cyan projected light with silhouette glow, scan lines and a scan bar, faint flicker, a projector with ring, pulses,
  beam and motes. Rejected before it: a bust facing the camera, the rectangular photo ("like a screen"), a plain
  see-through figure, and a photo frame on the desk. It faces the astronaut, at most 41 degrees off the camera.
  Keep the picture **flat**: a relief that pushed the face forward made it look swollen (Raju, 2026-11-28).
- Courses now have their own card in SC11a (rest 0.66, after Certifications at 0.48; SC11a is 2.25 screens).
- Cost at SC02's busiest frame: 127 draw calls Balanced (budget 150), 78 Low (plan 70; about 73 before this work).

## Done (2026-11-28, floating screens and the ignition button)
- Raju asked for science-fiction air screens (Tony Stark style) at the desk, then in the cockpit. Shared parts in
  `src/chapters/holo/` (panes, geometry, atlas drawing, `HoloPanes.tsx`) with `shaders/holoScreen.ts`; one mesh, one
  draw call per set.
  - Desk (SC02/SC03, `room/holo*.ts`): code, scroll engine, flight-plan radar, two dials, keys of light, a beam.
  - Cockpit (SC04, `cockpit/holoLayout.ts`, `screens.ts`): the crew record and flight plan float over the dash, unfold
    as the astronaut sits and fold away before the close-up (`arrival.ts` `screensOpen`).
- Raju: the move to the ignition button looked bad. New control (`cockpit/Ignition.tsx`, `shaders/ignition.ts`):
  recessed plate, domed button, hinged safety cover, arming rings, IGNITION → LAUNCH label, all from `ignitionAt(t)`;
  angled camera approach, then out through the windscreen.
- **Restyled after Raju's film references** (clear glass, layered HUD, globe): fine-edged glass panes, far and near
  layers (`holo/hud.ts`: rings, hex field, node network, ship blueprint, data window; no words or figures), a globe of
  light over the flight plan (`holo/HoloGlobe.tsx`, from `earth_day_2k`), atlases shared between copies and half size
  on Low (`holo/atlasCache.ts`; far layers are left out on Low).
- **Depth order** (Raju: "the starting screens dominating... blend everything"): each pane has `gain` and `soft`
  (blur). Desk screens are dim and slightly soft; cockpit records stay sharp; everything else steps back. The windscreen
  sill is dimmed so it does not cross the record text.
- **No photo on the Experience card** (Raju, "my image is no need here"). The desk hologram and the Mission Brief still
  show it.
- Draw calls: SC02 t 0.6 113 Balanced / 66 Low; SC04 ≤111 / 64. GPU textures stable over SC02↔SC05 round trips; worst
  entry hitch in SC02–SC04 67 ms (`measure-freezes`).
- Checks: verify 159/159, build OK, Playwright 28 passed, 2 skipped.

## Remaining tasks, in order
1. Review the line art (ink from depth) in SC10-SC12 with Raju.
2. The farm on Low still uses the simplified copy (thin trees and ridges): a better low variant if it matters.
3. Dev-only console warning `glGetProgramiv: Program object expected` after a cold jump into SC11: no JS-side query
   of a deleted program exists, and adding synchronous `getError` probes makes it vanish, so it is a timing quirk
   inside the browser's GL layer. Not seen to affect anything; left as is.
4. Entry hitches are now small (worst 67 ms, headless Balanced run): re-measure after adding models.

## Parked until the end (content, mobile)
- Content: Spotmies end date (LinkedIn "Present" vs resume "Jun 2026"); Sports Paramount spelling; Spotmies project
  details (stack, links, what each does); approve availability/learning wording; resume PDF shows his phone number;
  emblem/initials question U13 is closed (no emblem).
- Credits still missing: HelVela II (A024) page and author, launch pad (A037), EVA suit (A039).
- Mobile layouts.
