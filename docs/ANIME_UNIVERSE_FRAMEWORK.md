# ANIME UNIVERSE FRAMEWORK

> **Structure only.** Specific worlds, locations, characters and scenes are deliberately **not** designed here; that is a later creative decision.
> The anime titles you named (Demon Slayer, Naruto, Death Note, One Piece) are **inspiration for visual language only**. We will not use their characters, symbols, logos, names, music, costumes, locations or recreated scenes.

## 1. Why the anime universe exists in the story
The solar system is the **proven** world: real places, real work. Beyond its edge lies the **imagined** world, where ideas exist before they are built. Narratively, it does three jobs:
1. **It shows the person, not just the CV.** It is where discipline, credentials, curiosity and ambition live.
2. **It adds a second climax.** After realistic space, a deliberate change of art style resets attention before the ending.
3. **It is memorable.** It makes the portfolio distinctive among recruiters' daily review load, as long as it stays short.

## 2. Position in the journey
`... Saturn (SC09) → The Edge & Crossing (SC10) → Anime universe (SC11, about 22% of scroll) → The Return (SC12) → Homecoming & contact (SC13)`

It is **one connected universe** crossed in one continuous flight, with **2–3 themed areas** (A, B, C). Areas are joined by stylised transitions (speed lines, cloud walls, ink wipes), not loading screens.

## 3. The visual transition (realistic → anime → realistic)
| Stage | What happens | Technique (planned) |
|---|---|---|
| Gate approach | Lensing distortion of the stars | Screen-space distortion shader |
| Re-drawing | Geometry is reduced to **ink line art** (edges only, paper-tone background) | Outline/edge pass blending in |
| Colour flood | Flat **cel colour** fills the line art in bands | Toon material ramp blending in |
| Arrival | Fully stylised sky, light and atmosphere | The anime art-style profile is fully active |
| Return (SC12) | The same sequence in reverse | The same system, run backwards |

Because the blend is driven by scroll progress, it reverses exactly. This absorbs the Batch 1 "Unbuilt" idea (wireframe → solid) into a single meaningful transition.

## 4. Continuity of the astronaut and spacecraft
- **Same models and silhouettes.** Only the materials switch to toon shading with outlines. No new character model.
- **The gold visor** becomes a flat, graphic gold reflection, which is still instantly recognisable.
- **The mission emblem** stays identical across styles (it's vector art). It gains its fourth segment here.
- **The interface language** (typography, panel style, single accent colour) stays the same in both styles. Content panels look like they belong to the ship, wherever it is.
- **The ship's engine glow colour** stays the same, so the visitor always knows which object is "us".

## 5. Professional content slots
Each area has one **content slot**, shown on a ship display or as a single in-world structure (a monument, banner, shrine-like gate or signal tower; the design is decided later). Keep the text minimal.

| Area | Theme (structural) | Content | Source status |
|---|---|---|---|
| A · Discipline | Training, practice | **Certifications** (6 in `ResumeNew.jsx`), plus a coding practice link (LeetCode) | ✅ certifications; ❓ problem count |
| B · Proof | Trials overcome | **Verified achievements** only (e.g. hackathon, *if* confirmed) | ❓ All need evidence. If none are confirmed, **merge B into A** (2 areas). |
| C · Horizon | Looking ahead | **Currently learning and future direction** (the work you want to do next) | ⛔ Not in the source; you must write it |

**Rule:** if a slot has no verified content, the area is removed, not padded.

## 6. Inspiration boundaries (originality rules)
**Allowed: general visual language** shared across anime as a medium:
- cel shading and stylised lighting;
- dramatic sky gradients and towering clouds;
- ink and brush line work;
- speed lines and impact frames;
- painterly backgrounds;
- seasonal particles (petals, leaves, embers, snow);
- lantern or neon night palettes;
- ocean-adventure horizons;
- gothic noir contrast.

**Not allowed:**
- named characters, look-alikes or costumes (including signature patterns);
- village or clan symbols, crests, flags, jolly rogers;
- named places or recognisable recreated locations;
- iconic objects (e.g. a specific notebook design);
- quotes, catchphrases, music or sound effects;
- title logos or fonts;
- "fan-art" assets downloaded from the web.

**Originality test:** if someone could name the franchise from a single frame, the frame fails.
**AI-generated art:** not used for any anime-universe asset unless its licence and provenance are documented and you approve it.

## 7. Asset strategy (free assets, no Blender expertise assumed)
- **Mostly code-driven stylisation:** toon ramps, outlines (inverted-hull method; cheaper than post-processing on mobile), gradient skies, billboard clouds with noise, particle systems.
- **Simple geometry** for monuments and structures (code-generated or free CC0 stylised packs, re-coloured).
- **Hand-painted backgrounds or original character designs** count as professional-level work. They are out of scope unless you later choose to commission them.

## 8. Return to realistic space
At the far side of the universe the gate reappears, the reverse transition plays, and the ship emerges near **Earth at dawn**. That closes the loop opened by the room's window view of the launch pad.

## 9. Decisions deferred to the anime design phase
- Number of areas (2 or 3, depending on verified content).
- The theme and look of each area (original, inspired by the general language above).
- What in-world structure displays each content slot.
- Whether the astronaut appears outside the ship in this universe.
- Whether there is an optional, original soundtrack cue (licensed or royalty-free only).
