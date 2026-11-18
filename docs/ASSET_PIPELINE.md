# ASSET PIPELINE

> No assets have been downloaded or purchased. Paid assets are **not assumed**; every category has a free route, with paid options noted as optional.
> **Honesty note:** Claude can write shaders, procedural geometry and optimisation scripts. Claude **cannot** produce production-quality sculpted models, clean topology, convincing character animation, or hand-painted art by writing React code. Those come from libraries, Blender work, or an artist.

---

## 1. Classification at a glance

| Category | Procedural in code | Existing model | Blender work | Rig/anim | Professional-level effort if custom |
|---|---|---|---|---|---|
| Developer room | ❌ (props) / ✅ (shell) | ✅ props | ✅ assembly + **light bake** | ❌ | Full custom room |
| Astronaut | ❌ | ✅ | ✅ patch/name-tape texture, cleanup | ✅ retarget library motions | Custom suit model + mocap |
| Astronaut animations | ❌ | ✅ motion library | ✅ cleanup / trims | ✅ | Bespoke interactions (helmet, door) |
| Spaceship exterior | ❌ | ✅ | ✅ split into named parts | Simple object anim | Custom hero ship |
| Cockpit interior | Screens ✅ | ✅ or kit-bash | ✅ trim to camera-visible part, bake | ❌ | Full custom cockpit |
| Launch pad | Partially | ✅ low-detail | Light | ❌ | — |
| Earth / Moon / Mars / Jupiter / Saturn | ✅ sphere + shaders | Textures ✅ | ❌ | ❌ | — |
| Sun | ✅ fully | ❌ | ❌ | ❌ | — |
| Moon close-pass terrain | ✅ heightmap terrain | Elevation data ✅ | Optional | ❌ | — |
| Asteroid belt | ✅ instancing | 3–5 rock meshes ✅ (or generated) | Optional | ❌ | — |
| Stations / project structures | Kit-bash partially | ✅ modular kits | ✅ re-dress per project | Simple lights/rotations | Custom hero stations |
| Project diorama (Tier 1) | ✅ mostly (depends on project) | Small props ✅ | Light | Procedural motion | — |
| Saturn rings | ✅ ring shader + particles | Ring texture ✅ | ❌ | ❌ | — |
| Voyager 1 | ❌ | ✅ NASA model | Cleanup + decimate | ❌ | — |
| Milky Way / galaxies / nebulae | ✅ procedural **or** panorama | Panorama ✅ | ❌ | ❌ | — |
| Wormhole | ✅ lensing shader | ❌ | ❌ | ❌ | — |
| **Anime-inspired universe** | ✅ toon shading, outlines, stylised skies, painterly fog | Stylised models ✅ (must be checked for IP) | ✅ stylisation, vertex colours | Possibly (Batch 3) | **Painted backgrounds, original character/creature designs** |
| Final contact environment (platform, beacon) | Beacon light/pulse ✅ | ✅ or simple custom | ✅ simple modelling (feasible) | Beacon object anim | — |

---

## 2. Category details

### 2.1 Developer room
- **Route:** assemble the room from free CC0/CC-BY props (desk, chair, monitors, books, lamp, shelf). The room shell (walls, window, door) is simple Blender modelling.
- **The realism comes from baking:** bake lighting and AO into lightmaps in Blender (Cycles), applied in Three on a second UV set. Use only one or two real-time lights (lamp, monitor glow) for the astronaut. **[verify lightmap UV channel mapping in three r18x during spike S3]**
- **Monitor content:** canvas textures from real code (your repository, with permission) at runtime.
- **Format:** one GLB for static baked geometry (merged by material) plus separate GLBs for interactive props. KTX2 textures.
- **Budget (High tier):** ≤ 150k triangles, ≤ 6 MB compressed, ≤ 40 draw calls.
- **Licensing:** CC0 is ideal; CC-BY requires credits in an attribution page; check that "NoDerivatives" isn't present (we modify assets).

### 2.2 Astronaut
- **Route:** a rigged or rig-able modern suit model from a library (free or paid optional). If unrigged, use an auto-rigging service with a humanoid skeleton, then fix weights in Blender.
- **Requirements:**
  - Opaque/gold visor (no face).
  - ≤ 30k triangles.
  - ≤ 3 materials.
  - 2K textures (1K mobile).
  - A separate helmet node for the "helmet on desk" shot.
  - Mission patch and name-tape decal slots.
- **Anime-style compatibility:** clean UVs and simple material slots, so a toon material set can be swapped in.
- **Format:** GLB (skinned) + Meshopt + KTX2. Target ≤ 3 MB.
- **Licensing:** confirm the licence permits modification, web use, and use alongside retargeted animations.

### 2.3 Astronaut animations
- **Route:** a free motion library (e.g. Mixamo) for idle, seated-typing, look-up, sit-to-stand, walk-in-place, reach and seated-down. Retarget onto the astronaut's rig. Clean up in Blender (trim, loop, remove root drift).
- **Rules:**
  - Walk is **in-place**.
  - Clips are named consistently.
  - Clips are exported as separate actions in the same GLB, or as one animation GLB.
  - Animation data is compressed with Meshopt.
- **Not from libraries:** helmet put-on, door opening and beacon planting are covered by camera cuts and object animation.
- **Licensing:** check the current terms of the chosen library. Typically use in projects is allowed but raw redistribution is not. **[verify at sourcing]**

### 2.4 Spaceship (exterior + cockpit)
- **Exterior:** a near-future crew vehicle from a library. Split into named nodes in Blender (hatch, legs, RCS, engine bells, heat-shield face). ≤ 80k triangles. The heat-shield side gets its own material for the Sun scene.
- **Cockpit:** library or kit-bash, **trimmed to what the camera sees**, baked lighting. Screens are separate meshes with canvas/DOM-driven textures. ≤ 100k triangles.
- **Hatch frame:** modelled together with the room door frame so the match cut aligns (simple Blender work).
- **Format:** separate GLBs for exterior and cockpit, so they never load at the same time unless needed.

### 2.5 Earth, Moon, Sun and planets
- **Procedural in code:** spheres, atmosphere scattering approximation (rim/Fresnel), cloud layer, night-lights blend on the dark side, specular ocean mask, Jupiter band motion, Sun granulation/corona/prominences (fully shader-based).
- **Textures:** public planetary texture sets derived from NASA data. **Check each set's licence** (many common sets are CC BY 4.0 and need attribution). Convert to KTX2. 4K High / 2K Balanced / 1K Low.
- **Moon close pass:** a terrain strip from a heightmap (public lunar elevation data) plus detail normal map. Only the strip the camera skims is high resolution.
- **Mars outposts:** emissive point sprites or small instanced lights (procedural).

### 2.6 Asteroid belt
3–5 rock meshes (CC0 scans decimated to ≤ 2k triangles, or generated by noise-displaced icosahedrons in code), rendered with **instancing** (one draw call per mesh type). Beacons on selected rocks are tiny emissive meshes plus DOM labels.

### 2.7 Stations & project structures
- One **modular station** (hub, truss, solar panels, docking port) from a CC0/CC-BY kit or simple Blender kit-bash, re-dressed per project with colour accents, decals and module arrangement.
- ≤ 40k triangles each.
- **Tier 1 diorama:** built mostly in code if the project concept allows it (e.g. procedural roads and vehicles). Its exact form depends on the verified project facts.

### 2.8 Saturn and rings
Sphere + texture. Rings come from a radial texture on a ring geometry plus a shader for lit/backlit scattering, plus an instanced particle layer near the camera for scale. Ring bands for the stack are shader-highlighted ranges with DOM labels.

### 2.9 Galaxy, deep space, wormhole
- **Sky:** a procedural starfield (seeded points with magnitude distribution) plus a Milky Way band. Either procedural noise, or a licensed panorama (ESA/ESO imagery is often CC BY 4.0, but some ESA images are CC BY-SA 3.0 IGO; check per image). Panoramas are heavy, so use 4K cubemap KTX2 on High and procedural on Low.
- **Voyager 1:** NASA 3D resources. Decimate. Check NASA's media guidelines (no implied endorsement; insignia restrictions).
- **Wormhole:** a screen-space gravitational-lensing shader sampling the sky. No assets.

### 2.10 Anime-inspired universe (asset *strategy* only; designs in Batch 3)
- **What code can do well:**
  - Toon/cel shading with stepped lighting ramps.
  - Outline rendering (inverted hull or post-process edge detection).
  - Stylised gradient skies.
  - Painterly volumetric-look clouds (billboards + noise).
  - Stylised water.
  - Speed lines.
  - Bloom-accented emissives.
  - **Line-art-to-colour reveal** (a natural bridge from Batch 1's "Unbuilt" wireframe concept, offered for Batch 3 consideration).
- **What needs sourced or created art:** stylised environment models (CC0 stylised packs exist), and any **hand-painted backgrounds** or original character/creature designs. These are **professional-level** if they must be bespoke.
- **IP warning:** "anime-inspired" must remain a *style*. No recreation of a specific studio's or franchise's characters, locations or signature designs. Avoid AI-generated art trained on identifiable studio styles unless its licence and provenance are clear.
- **The astronaut** re-uses the same rig with a toon material set (no new character model).

### 2.11 Final contact environment
A small platform (simple Blender model or CC0 sci-fi piece), plus a beacon (simple model with emissive parts and a procedural pulse). The astronaut uses library motions (stand, idle; "plant" via cut). Final look per Batch 3.

---

## 3. Blender workflow (standard for every model)

1. **Import and audit:** scale (1 unit = 1 m), forward/up axes, triangle count, material count, texture sizes, licence noted.
2. **Clean up:**
   - Apply transforms.
   - Remove hidden or interior faces the camera never sees.
   - Merge static meshes by material.
   - Name nodes meaningfully (`Ship_Hatch`, `Room_Door`, `Astro_Helmet`). Code finds parts by these names.
3. **UVs:** UV0 for materials. UV1 (second set) for baked lightmaps on static environment pieces.
4. **Materials:** glTF-compatible Principled BSDF only (base colour, metallic-roughness, normal, emission, AO). Procedural Blender nodes don't export, so bake them to textures.
5. **Baking (static environments):** Cycles bake of combined light/AO to a lightmap atlas per environment. Denoise, then save as 16-bit and convert to KTX2.
6. **Rigging/animation (astronaut):** humanoid armature, ≤ 65 bones, ≤ 4 influences per vertex. Actions named `idle`, `type`, `lookUp`, `standUp`, `walk`, `reach`, `sitDown`. NLA tracks pushed so each action exports.
7. **Export:** glTF 2.0 **binary (.glb)**, +Y up, selected collection only, animations included where relevant, no cameras or lights (lights are authored in code), no textures embedded at full resolution (handled by the optimiser).
8. **Commit only optimised outputs** to the repo (`public/assets/...`). Source `.blend` files live outside the repo or in Git LFS (decision pending).

## 4. Optimisation pipeline (scripted, repeatable)

Each model goes through a scripted glTF-Transform pass (exact commands are fixed in the `asset-pipeline` skill during Batch 3 after a test run):

1. `inspect`: record triangles, materials, textures and size *before*.
2. `dedup` → `prune` → `weld`. Optionally `simplify` (never on skinned hero meshes without visual check).
3. `resize` textures to the tier's maximum (power-of-two).
4. **Texture encoding to KTX2:** ETC1S for colour, roughness and AO; UASTC for normals and hero detail. Requires KTX-Software.
5. **Geometry:** `meshopt` (default) or `draco` (static-heavy, if measured smaller). Never both.
6. `inspect` again and record *after* values in the **asset register**.
7. Produce tier variants where needed (`*.high.glb`, `*.low.glb` or texture-only variants).

## 5. Asset register (to be created in Batch 3)
A single table (`assets/ASSET_REGISTER.md`) with one row per asset: id, source URL, author, licence, attribution text, modifications made, triangle count, file size per tier, chapters using it. **No asset ships without a complete row.** The public credits page is generated from it.

## 6. Licensing checklist (per asset)
- [ ] Licence type recorded (CC0 / CC-BY / CC-BY-SA / store licence / public domain).
- [ ] Commercial and portfolio use allowed (a portfolio can count as commercial self-promotion).
- [ ] Modification allowed (no "ND").
- [ ] Web distribution of the optimised file allowed (some store licences forbid making source files downloadable; a GLB served on the web *is* downloadable, so check "real-time / game engine use" clauses).
- [ ] Attribution text captured.
- [ ] Share-alike obligations understood (CC-BY-SA applies to the asset, not your code, but must be credited and shared under the same licence).
- [ ] No trademarked logos (agencies, brands) used in a way that implies endorsement.
- [ ] For AI-generated material: provenance and terms documented, and not used for hero assets without approval.

## 7. Budget summary (initial targets; validated in Batch 3 spikes)
| Chapter group | High tier download | Low tier download |
|---|---|---|
| Boot + first chapter (room, astronaut) | ≤ 8 MB | ≤ 3.5 MB |
| Any later single chapter | ≤ 6 MB | ≤ 2.5 MB |
| Whole journey (streamed, not at once) | ≤ 45 MB | ≤ 18 MB |
