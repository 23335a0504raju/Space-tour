# FINAL STORYLINE (Batch 3)

> Status: **Draft for your approval.** This document **supersedes** the Batch 1 scene list in `STORYBOARD.md` (kept for history).
> All personal content comes from the existing portfolio (`c:\projects\MainPortfolio\port`). Sources and conflicts are in `PORTFOLIO_CONTENT_MAPPING.md`. Anything marked `[TO CONFIRM]` must not ship until you confirm it.
> Specific anime worlds are **not** designed here (see `ANIME_UNIVERSE_FRAMEWORK.md`).

---

## The story in one paragraph
Late at night in a futuristic developer room overlooking a launch pad, an astronaut finishes a piece of work, stands up and walks out. The door becomes the spacecraft's hatch. In the cockpit, the ship's screens show the crew record: education and internships. The ship launches. In orbit, at sunrise, its instruments read the sunlight, and the spectrum reveals the pilot's core strengths. The ship then makes **one continuous outbound flight** past the Moon, Mars and the asteroid belt to Jupiter, where it docks briefly at three orbital **project installations**, and to Saturn, whose rings show the **technology stack** in layers. At the edge of the solar system the ship crosses into an **anime-inspired universe**, a connected world of themed areas that shows the person behind the work: discipline, credentials and ambition. The ship returns through the same gate into real space and comes home to Earth at dawn. The astronaut steps onto the hull, deploys a beacon, and opens a channel: **contact**.

**Through-line:** *Build → launch → prove → imagine → return and connect.* The journey is a full loop, from home and back, so the ending feels earned rather than abrupt.

## Story devices that hold it together
1. **The mission emblem.** A custom emblem (designed as vector art, see `CREATIVE_DECISIONS.md` B3-11) appears on the astronaut's shoulder, the ship's hull and the progress indicator. **Each act adds one segment to the emblem**, and the emblem is complete at the final transmission. Progress, branding and narrative are one object.
2. **The ship's interface.** Portfolio content appears mostly on **ship displays, holographic panels and installations**, not floating cards. One consistent interface language (instrument-grade, monochrome, single accent colour) is used in both art styles.
3. **The light.** In space, the Sun is the only key light. In the anime universe, light becomes stylised. Returning home, a real sunrise again.
4. **The gate.** The same gate is entered and exited, which explains both art-style transitions.

## Acts and scenes
| Act | Scenes | Purpose |
|---|---|---|
| I · Origin | SC01–SC03 | Who you are. Short. |
| II · Launch | SC04–SC06 | Experience, education, core strengths |
| III · Transit | SC07–SC09 | Projects and stack, inside one continuous flight |
| IV · Beyond | SC10–SC12 | The anime universe: the person behind the work |
| V · Homecoming | SC13 | Contact |

---

## SC01 · Signal (shell and loading)
1. **Purpose:** information first. A recruiter can act within seconds.
2. **Visitor sees:** black screen with **name, role, and buttons for Projects, Resume, Contact and Mission Brief**, all in HTML. A thin emblem outline fills with *real* loading progress.
3. **Astronaut:** not visible.
4. **Camera:** none.
5. **Environment:** none.
6. **Scroll:** disabled only until the first scene is ready, a few seconds at most. All buttons work immediately.
7. **Transition:** fade up into the room.
8. **Content:** name; role `[TO CONFIRM: "Software Engineer" vs "Full-Stack Software Engineer & AI Builder"]`.
9. **Difficulty:** Low.

## SC02 · The Room
1. **Purpose:** establish the character and the mood. One room only.
2. **Visitor sees:** a compact futuristic developer room: a desk, two or three monitors, a suit rack, panel lighting, and a **large window showing the spacecraft on a floodlit launch pad** (the ship is foreshadowed).
3. **Astronaut:** suited, gold visor up or helmet on the desk, typing.
4. **Camera:** starts on the window reflection of the ship, then a slow pull-back revealing the astronaut at the desk.
5. **Environment:** monitor glow flicker, pad floodlights, light dust in the air (ambient).
6. **Scroll:** controls the pull-back (rest point 1).
7. **Transition:** cut to over-the-shoulder at the desk.
8. **Content:** name and role, as a title card.
9. **Difficulty:** Medium. Assembling the room from free assets and baked lighting is the challenge.

## SC03 · Departure
1. **Purpose:** the decision to leave. A one-line introduction.
2. **Visitor sees:** a monitor with real code and a successful build or deploy log `[TO CONFIRM: which repository's code may be shown]`; the astronaut standing up and walking to the door.
3. **Astronaut:** types → pauses → stands (the helmet is on after a cut) → walks → reaches for the door.
4. **Camera:** over-the-shoulder → low tracking dolly → turns to face the door → pushes through.
5. **Environment:** the door opens to bright light, then a **match cut** to the ship's hatch frame.
6. **Scroll:** drives stand-up, walk distance and the door. Reversing walks the astronaut back.
7. **Transition:** door frame → hatch frame (white-out bridge).
8. **Content:** one-line introduction, adapted from `ResumeNew.jsx`: *"Software Engineer specializing in scalable web applications, APIs, and full-stack systems…"* `[TO CONFIRM final wording]`.
9. **Difficulty:** **High.** A scroll-scrubbed walk on a free rigged model is the riskiest moment in the film. It is covered by spike S2, with a fallback of cutting from standing straight to the door.

## SC04 · Cockpit: Crew Record
1. **Purpose:** the most important recruiter content, early: **experience and education**.
2. **Visitor sees:** a compact futuristic cockpit with a wide window (the launch tower outside) and screens booting.
3. **Astronaut:** seated, straps in (simplified), with a gloved hand on the console.
4. **Camera:** hatch → over-shoulder → slow push onto the central display → back out for the ignition switch.
5. **Environment:** screens boot in sequence, with switch backlights.
6. **Scroll:** two rest points: **Experience**, then **Education**. Each entry has "Open full record", which opens a panel.
7. **Transition:** the gloved hand flips ignition, then a cut to the exterior.
8. **Content:**
   - **Experience:**
     - Spotmies, Full-Stack Developer Intern, Dec 2025 – Jun 2026.
     - Pit Solutions, Frontend Development Intern, Dec 2022 – May 2023.
     - *(Any MeraSports / Arcslot work is listed here only if you confirm it.)*
   - **Education:**
     - B.Tech, MVGR College of Engineering, 2023–2026 `[TO CONFIRM CGPA 8.31 vs 8.36; specialisation]`.
     - Diploma in Computer Engineering, Govt Polytechnic Anakapalli, 2020–2023 (83%).
9. **Difficulty:** Medium. The screens are canvas or DOM, with a cockpit asset.

## SC05 · Ignition & Ascent
1. **Purpose:** the energy peak; the first full view of the ship.
2. **Visitor sees:** a wide exterior of the ship on the pad, ignition and liftoff, the cloud deck torn through, and the sky going blue to black.
3. **Astronaut:** not visible (the ship is the character).
4. **Camera:** wide locked shot → tracking shot alongside → window point of view through the clouds.
5. **Environment:** shader exhaust plume, sprite smoke, layered cloud planes, a light camera shake (disabled in reduced motion).
6. **Scroll:** engine intensity → liftoff → altitude.
7. **Transition:** the sky fades into the curve of the Earth.
8. **Content:** none (a deliberate breath).
9. **Difficulty:** Medium.

## SC06 · Orbital Sunrise: Core Strengths *(Pause 1)*
1. **Purpose:** the signature beauty shot, and **what you are made of**.
2. **Visitor sees:** Earth's night side with city lights, then the Sun rising over the limb. The Moon is visible and recognisable in the distance.
3. **Astronaut:** a brief interior beat. The visor reflects the sunrise while the spectrometer screen activates.
4. **Camera:** behind the ship → slow rotation → cockpit spectrometer display.
5. **Environment:** the atmosphere's rim glow and the moving terminator. Sunlight splits into a spectrum, and its dark lines appear and are labelled.
6. **Scroll:** sunrise → spectrum → lines one by one (rest point).
7. **Transition:** the ship turns outward and the engines burn.
8. **Content:** 3–5 core strengths `[TO CONFIRM]`. The proposal below uses only evidence in the source:
   - full-stack web applications;
   - API and backend design;
   - applied AI (computer vision, RAG);
   - cloud deployment;
   - cross-platform mobile.
9. **Difficulty:** Medium. Earth and atmosphere shaders are well understood; the spectrum is UI.
   *(This replaces the Batch 1 Sun slingshot, removing the inward detour.)*

## SC07 · Outbound: Moon, Mars, Belt
1. **Purpose:** the sense of a real journey without stopping at every planet.
2. **Visitor sees:** the Moon passing close, Mars sweeping by (recognisable rust colour and polar cap), then a short pass through the asteroid belt.
3. **Astronaut:** not visible.
4. **Camera:** ship profile tracking; a fast parallax fly-through in the belt.
5. **Environment:** the ship's RCS puffs, a fresh light angle for each body, instanced asteroids.
6. **Scroll:** continuous, with no pause. In the belt, 3–5 **supporting-project beacons** show **names only**, and can be clicked to open a project dossier.
7. **Transition:** the belt thins and Jupiter's banded disc grows.
8. **Content:** supporting project names (`PROJECT_PRESENTATION_PLAN.md`).
9. **Difficulty:** Medium.

## SC08 · Jupiter: Project Installations *(Pause 2)*
1. **Purpose:** the core of the portfolio: **flagship projects**.
2. **Visitor sees:** Jupiter filling the frame, and three small orbital installations against it, one per flagship project, each with a distinct silhouette that reflects the project's real architecture.
3. **Astronaut:** not visible (an optional brief visor reflection at docking).
4. **Camera:** wide establishing shot → approach each installation in turn (three rest points).
5. **Environment:** docking lights, slow station rotation, Jupiter's bands drifting (ambient).
6. **Scroll:** each installation shows a title, a one-line purpose and your role, plus **"Enter Project Bay"**. The Bay pauses the journey; closing it returns the visitor to the exact frame.
7. **Transition:** departure burn, and Saturn appears backlit.
8. **Content:** SmartWay Traffic, DocumentDB, and Stash (proposed; see `PROJECT_PRESENTATION_PLAN.md`).
9. **Difficulty:** **High** (Project Bay, three installations, one diorama).

## SC09 · Saturn: Stack Rings *(Pause 3)*
1. **Purpose:** the technology stack, structured and quick to scan.
2. **Visitor sees:** Saturn backlit with the rings edge-on. They open up as the camera rises, with bands highlighting one at a time.
3. **Astronaut:** not visible.
4. **Camera:** rising arc over the ring plane, with ring particles near the lens.
5. **Environment:** the backlit ring glow and the planet's shadow on the rings (computed in the shader).
6. **Scroll:** band by band (one rest point with all bands visible at the end).
7. **Transition:** Saturn recedes; the Sun becomes a bright star.
8. **Content:** stack groups from `Portfolio.jsx` (Languages; Frontend & Mobile; Backend & APIs; Data & Cloud; AI & Automation). Text only, no percentages, no logos.
9. **Difficulty:** Medium.

## SC10 · The Edge & The Crossing
1. **Purpose:** the threshold from proven to imagined, and the art-style transition.
2. **Visitor sees:** the solar system's edge (quiet, sparse, cold), then a gate or anomaly ahead. Inside it, reality is **re-drawn**: geometry dissolves into ink line art, then flat cel colour floods in.
3. **Astronaut:** a brief cockpit beat. The visor reflects the gate.
4. **Camera:** slow approach → entry → stylised tunnel → emergence.
5. **Environment:** lensing distortion → line-art reveal → toon shading takes over.
6. **Scroll:** controls the style blend (fully reversible).
7. **Transition:** emergence into the anime universe.
8. **Content:** none, or a single line `[TO CONFIRM]`.
9. **Difficulty:** **High** (two art-style profiles blended in one transition).

## SC11 · The Anime-Inspired Universe *(structure only)*
1. **Purpose:** the person behind the work: discipline, credentials and ambition.
2. **Visitor sees:** **one connected universe** with 2–3 themed areas, crossed in one continuous flight. Specific worlds are **to be designed later**.
3. **Astronaut:** visible again in toon shading, at one moment per area (looking out, or standing on the hull).
4. **Camera:** sweeping establishing shots, one pause per area.
5. **Environment:** stylised skies, painterly clouds, speed lines in the transitions between areas.
6. **Scroll:** one rest point per area.
7. **Transition:** the gate appears again, marking the way home.
8. **Content slots:** see `ANIME_UNIVERSE_FRAMEWORK.md` §5:
   - credentials (certifications);
   - verified achievements;
   - currently learning and future direction `[TO CONFIRM: not in source]`.
9. **Difficulty:** **High** (art direction and original assets).

## SC12 · The Return
1. **Purpose:** leave the imagined universe and come back to reality.
2. **Visitor sees:** the reverse of the crossing. Cel colour drains back to line art, then to realistic rendering, and real stars return.
3. **Astronaut:** not visible.
4. **Camera:** a fast tunnel, then a calm emergence.
5. **Environment:** the reverse style blend.
6. **Scroll:** linear.
7. **Transition:** Earth and the Moon come into view at dawn.
8. **Content:** none.
9. **Difficulty:** Medium (reuses the SC10 system).

## SC13 · Homecoming & Final Transmission
1. **Purpose:** a satisfying conclusion and **clear contact**.
2. **Visitor sees:** the ship in high orbit above Earth at sunrise (a bookend with the room). The astronaut steps onto the hull or an exterior platform and deploys a beacon. The **completed emblem** locks into place.
3. **Astronaut:** steps out → stands → beacon (a cut covers the "planting") → turns slightly toward camera.
4. **Camera:** wide → medium; a long, calm hold.
5. **Environment:** the beacon pulses outward; the sunrise; a slow drift.
6. **Scroll:** final rest point. The page ends here; there is no further scroll.
7. **Transition:** none. "Replay mission" returns to the top.
8. **Content:** the full contact panel (`CONTACT_EXPERIENCE.md`).
9. **Difficulty:** Medium.

---

## What was cut, and why
| Removed / changed | Reason |
|---|---|
| Moon = Education, Mars = Experience (Batch 1) | Your direction: no per-planet chapters. Education and experience moved to the cockpit, earlier, which is better for recruiters. |
| Sun slingshot | An unnecessary inward detour. Core strengths are now shown at the orbital sunrise. |
| Voyager / "Edge" learning beat | Content moved into the anime universe; it shortens the film |
| "The Unbuilt" as a separate universe | Absorbed into the crossing's line-art → colour transition |
| Final transmission inside the unknown universe | Your direction: return to space; the homecoming bookend |
