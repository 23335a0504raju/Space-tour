# Next session: context and tasks (updated 2026-11-21)

## Where things stand

- Repo `c:\projects\Portfolio`, branch `main`. `origin/main` is at `de3a8ae`. **Everything below
  is uncommitted** (Raju commits only when he says so). Push as the personal account:
  `GH_TOKEN=$(gh auth token --user 23335a0504raju) git push origin main`.
- Checks at hand-off: `npm run verify` 110/110, `npm run build` OK, `npx playwright test` 24/24 (run
  before the last small preload fix, which only `verify` re-checked).
- Raju works one fix at a time and wants frames for each. He compares against reference images
  (dark, detailed, cinematic) and gets frustrated when results look plain.

### Uncommitted work since `de3a8ae`

- GPU leak fix: PMREM render targets are disposed via `renderTarget.dispose()` (SC05
  `useLaunchEnvironment`, room `useSharedIbl`).
- SC05: detailed cradles and clamps. SC12: the limb atmosphere. Ocean sun-glint weakened (bloomed
  into a white disc). Contact card restyled.
- Phones: project-stop camera centres each satellite above the card (`jupiterShot(t, out, aspect)`);
  short phones hide Source/Demo on the showcase card. `capture-shots` has `--small` (360x740) and
  `--wide` (1919x1067).
- SC03: camera pulls back during the stand (stays in front of the south wall, z < 0.35); chair
  rolls away earlier; notepads prop removed.
- **Astronaut, two looks** (`Astronaut` prop `variant`):
  - `crew` (default): Y Bot dressed in code (`suit.ts`), `public/assets/models/astronaut.glb`
    (A020). Used for sitting and walking in SC02 and SC03.
  - `eva`: the "player" EVA suit (A039, `public/assets/models/astronaut-eva.glb`), skinned onto the
    Y Bot rig by `npm run assets:astronaut` (`scripts/rig-transfer.ts`, `src/tools/rigTransfer.ts`).
    Used after the lift (SC13 homecoming). Seated poses tear the backpack, so it is not used seated.
  - A039 still needs the Sketchfab page URL and author (Raju says it is free on Sketchfab).
- **Navbar redesign**: floating editorial header (`src/app/App.tsx`, `App.module.css`): "RAJU."
  plus "Software Engineer" (`identity.shortRole` fact), a centre pill with About, Experience,
  Projects, Contact and a sliding gold indicator, and a right outlined pill (Mission Brief until the
  resume URL exists). Story line under it (`StoryLine` in Journey: section number and title, %, 1px
  gold fill written by the Director via `links.progressBar` and `links.progressText`). Phone:
  burger plus full-screen overlay. The bottom bar keeps only Flight Plan and the arrows.
- Small dark shards on the bridge floor near the desk: not the astronaut, chair or cockpit; they
  look like part of the bridge model (A036). Not fixed.

## Tasks for the new chat: Raju's items 4, 5 and 6 (do them one at a time, frames for each)

**4. SC05 sky. First pass built 2026-11-21, awaiting Raju's review.** `createSkyMaterial(galaxy, rot,
bandNormal, octaves)` samples the shared DeepSky bake (`bakeSky`, now exported) through `GALAXY_ROT`
(Ascent.tsx: core low ahead-left of the opening shot, band rising up-right), adds a procedural dust
rift/filaments and a highlight roll-off, and a magenta/violet airglow just above the horizon. HORIZON is now
#1c1f3d. Stars use the space star sprites (`starVertex`/`starFragment`, new `uFade`). Known: a navy stripe
remains between the airglow and the ground haze; the exhaust-lit cloud deck sits near the core at t≈0.5.
Original brief: The launch night sky is a flat blue gradient over a black ground. Raju's
reference is a Milky Way night photo: purple and magenta glow on the horizon, a bright galactic
band with dust lanes, dense stars. Files: `src/chapters/ascent/Ascent.tsx` (sky dome via
`createSkyMaterial` in `src/shaders/atmosphere.ts`, stars `makeStars`). The deep-sky generator
`src/chapters/space/DeepSky.tsx` (baked Milky Way, `GALAXY` plane) can be reused, blended in above
the horizon and dimmed by the city glow. Keep the far-plane rule (2 km) and the ground dissolving
into the horizon.

**5. Earth during the climb and later. Parts 1 and 2 built 2026-11-21, awaiting review.** (1) SC05
t ≥ 0.8: `OrbitEarth` in Ascent.tsx, a camera-centred planet (`ORBIT_EARTH` radius 1500, 100 m below,
`orbitEarth(t)` fade 0.8→0.9) with SC06's Earth and limb shaders; the flat ground and deck fade out, the
sky's horizon drops with `uDip`, a second star set fills the opened sky. (2) City lights (earth.ts, so
SC05/SC06/SC12/SC13): texel-warped lookup plus round jittered `cityDots` on 4x/12x grids, no squares.
Open: part 3 (the last Earth view looks flat); a higher-res night map (Black Marble) would add street-network
detail. Original brief: Raju's screenshots:
- SC05 high-altitude frames (t ≈ 0.8–1.0) show the "Earth" as a flat dark ground plane with a hard
  horizon and grey cloud sheets. It should read as a curved planet with an atmosphere limb (hand
  over into SC06's look: `createEarthMaterial`, `createLimbAtmosphereMaterial` in
  `src/shaders/earth.ts`).
- SC06 rest frame: city lights render as blocky white patches (the 2k night map magnified; see the
  `sparkle`/`near` band-pass in `earth.ts`). Needs finer, warmer clustered lights or a higher-res
  night map (NASA Black Marble is public domain; register it).
- The last view (SC12 or SC13 Earth) "looks flat": add terminator shading depth, clouds layer,
  limb atmosphere.

**6. Solar system planets.** Raju sent reference images of planets (realistic, detailed, lit with
strong terminators, rings) and an asteroid field, and expects the outbound journey (SC07, and
around SC08 and SC09) to show the solar planets, not only Moon, Mercury and Mars. Current bodies:
`src/chapters/outbound/outbound.ts` (Moon, Mercury, Mars, belt), Jupiter (SC08), Saturn (SC09).
Missing: Venus, and Uranus and Neptune (perhaps as distant passes). NASA and public-domain
textures only (register each, KTX2 via the asset pipeline). Respect the triangle and texture
budgets (`docs/PERFORMANCE_AND_ACCESSIBILITY_PLAN.md`).

**7. Anime worlds (SC11), after task 6. Raju will give the world details; wait for them before building.**
SC11 is three areas (`src/chapters/anime/anime.ts`: `discipline`, `proof`, `horizon`; scenes in
`areas.tsx`, `parts.tsx`, `clouds.ts`), currently generic stand-ins. Rebuild them as proper anime worlds
from the models Raju put in `raw-assets/` (git-ignored; convert with the asset pipeline: glTF → optimised
GLB/KTX2, tier variants, register each in `assets/ASSET_REGISTER.md` before committing). All Sketchfab,
licence in each zip's `license.txt`:

- `raw-assets/Naruto/`: Naruto Shippuden – Naruto (loose `scene.gltf`, #Anime resource!!!, CC-BY-4.0);
  Naruto & Sasuke Low Poly + Rig (ronildo.facanha, CC-BY-4.0); New_naruto in hindi (TRSgamings, CC-BY-4.0);
  Ichiraku Ramen (Doverlock, CC-BY-NC-4.0).
- `raw-assets/deathnote/`: Death note (xRUN), Ryuk from Death Note (PotBin), London Kinnaird House
  (99.Miles), West street (Pasha), Rural Buildings Set (Daniel Zhabotinsky); all CC-BY-4.0.
- `raw-assets/demonslayer/`: Tanjiro Kamado, fully rigged (Light.k), Nezuko Kamado (Atharva Jagtap),
  Blossom Katana (Mitchell Bekke), Low Poly Farm V2 (EdwinRC); all CC-BY-4.0.

**Raju's decision (2026-11-21): all of these are approved free resources; use them all, including the
NC ramen shop (personal, non-commercial portfolio). Do not raise licensing again.** Still credit every
author (CC-BY) in the Mission Brief credits and the asset register. Respect the triangle and texture budgets
(rigged characters can be heavy: decimate, one LOD per tier).

**8. Loading and opening animation, like Shopify Editions Winter '26.** Reference:
https://www.shopify.com/editions/winter2026 (open it and study the loader and the opening first; record
frames with Playwright to get the timing) and Raju's screenshot `raw-assets/reference/shopify-editions-loader.png`
(git-ignored). The look: a dark page, thin architectural guide lines and circles, and a glowing ring/globe built
from thousands of image shards and white sparkle particles that gather around a small centred title (a sans
title with one italic script word). Replace our "0–100%" counter loader (`src/ui/StartGate.tsx`; progress
comes from `src/engine/assets/preload.ts` `fraction`) with this: the load fraction drives how far the ring
assembles, then the opening reveals SC01 (e.g. the ring opens and the camera passes through it). Put Raju's
details in it (name, role, from `src/content/` facts only, never invented). Rules: no second WebGL
`<Canvas>` (use a 2D canvas or the main canvas), reduced-motion fallback, phone performance.

**9. Section transitions: a torn-paper scroll reveal instead of the black/white flash.** Reference: the same
site's section change, and `raw-assets/reference/shopify-editions-torn-transition.png`: the next layer slides
up over the current one with a ragged, fibrous torn-paper edge (white paper fibres, a soft shadow), moving
with the scroll. Today the boundary "dip" is a full-screen colour fade: `boundaryDip` and `links.dip` in
`src/engine/director/Director.tsx` (~l.159), the per-chapter dip colour in `src/chapters/contract.ts` (l.51),
the `.dip` layer in `src/engine/journey/Journey.tsx`, and the jump fade (`jumpFade`, ~l.423). Replace them
with the torn edge as a pure function of scroll progress (exactly reversible; one clock, GSAP). It still has
to hide each cut. Likely approach: render the outgoing and incoming chapters to textures during the
boundary window and composite them with a torn-edge mask shader (noise edge, fibres, shadow). Propose the
approach and its cost (two scene renders during the transition) before building. Keep it within the
performance budgets on the 780M and on Android.

## Still needs Raju

- Resume URL (Q5), CGPA 8.31 or 8.36 (Q2), HelVela II (A024) page and author, launch pad credit
  (A037: Lezalit or Kerem Kavalci), the EVA suit (A039) page and author, phone model (Q12).
- His own copy for SC05, SC10 and SC12. Anime worlds (SC11): the world details (task 7).

## Practical notes

- Read `CLAUDE.md` first; load the matching `.claude/skills/` skill (r3f-scenes for 4–6).
- Preview: `npm run build`, then `npx vite preview --port 4173 --strictPort` in the background,
  then `node scripts/capture-shots.ts <chapter-id>:<t,...> [--perf] [--low] [--portrait] [--small]
  [--wide]`. Stop the preview server before `npx playwright test`.
- Git Bash: no backticks inside `node -e`; write edit scripts to `$TMP/*.mjs`. Prettier reformats
  long lines, so string replacements written before formatting may miss: check the edit applied.
