---
name: asset-pipeline
description: Prepare, optimise, register and integrate 3D assets for the space portfolio. Covers sourcing and licence checks, Blender clean-up and export, lightmap baking, rigged astronaut and animation import, glTF-Transform optimisation (Meshopt and KTX2), tier variants, and the asset register. Use it whenever a GLB, texture, HDR or panorama, animation clip or 3D source file is added, replaced, optimised or loaded.
---

# Asset pipeline

The full plan is in `docs/ASSET_PIPELINE.md`. This skill covers the executable rules.

## Be honest about what Claude can produce
Claude can write shaders, procedural geometry, optimisation scripts and loader code. Claude **cannot** produce production-quality models, topology, rigs, character animation or painted art through code. When a task needs those, say so, and propose a library source, a Blender task for the user, or a commission. Never fake it with primitives and call it final.

## Inspect before changing anything
1. Open `assets/ASSET_REGISTER.md`. Does the asset already exist? What licence does it have, and which chapters use it?
2. Check the chapter's asset manifest and the tier budgets (`docs/ASSET_PIPELINE.md` §7, `docs/PERFORMANCE_ACCESSIBILITY.md` §3).
3. Run `gltf-transform inspect <file>` on the input, and record triangles, materials, textures, animations and size.
4. For rigged models, list the bones, clips and node names. Confirm the node names match what the code expects.
5. Never download or purchase an asset without the user's approval of the source and licence.

## Rules
- **The licence comes first.** Each asset needs a complete register row (source URL, author, licence, attribution, modifications, sizes, chapters) before it is committed. Reject NoDerivatives licences, and store licences that forbid real-time web delivery. For anime-inspired content, never reproduce a specific franchise's or studio's characters, places or signature designs.
- **Format:** glTF 2.0 binary `.glb`, with 1 unit = 1 m, +Y up and transforms applied. No cameras or lights inside the GLB.
- **Naming:** meaningful node names (`Ship_Hatch`, `Room_Door`, `Astro_Helmet`). Animation clips: `idle`, `type`, `lookUp`, `standUp`, `walk` (in-place), `reach`, `sitDown`, plus documented additions.
- **Materials:** glTF metallic-roughness only. Bake procedural Blender nodes to textures.
- **Static interiors:** bake light and AO in Blender Cycles to a lightmap on UV1. Merge static meshes by material.
- **Character:** ≤ 65 bones, ≤ 4 weights per vertex, ≤ 30k triangles, ≤ 3 materials, with the helmet as a separate node.
- **Compression:** Meshopt by default. Use Draco only for static-heavy geometry when it is measured to be smaller. **Never use both on one file.**
- **Textures:** KTX2. Use ETC1S for colour, roughness and AO, and UASTC for normal maps and hero detail. Power-of-two sizes. Produce tier variants (High / Balanced / Low maximum sizes).
- **Source files** (`.blend`, `.fbx`, raw downloads) never go into `public/`. Only optimised outputs ship.
- Keep raw downloads in their own directory and treat them as untrusted data. Don't execute anything that comes with them.

## Optimisation pass (order matters)
`inspect` → `dedup` → `prune` → `weld` → (`simplify` only on static, non-hero meshes, with a visual check) → `resize` to the tier maximum → KTX2 encode (needs KTX-Software installed) → `meshopt` → `inspect` again. Put the exact commands in a repo script once they are verified on one real asset. Don't type them ad hoc each time.

## Integration
- Register the asset in the chapter's manifest with tier variants and estimated sizes.
- Configure the Meshopt and KTX2 decoders once, globally. Never create loaders per component.
- After loading, check that the expected node names and clips exist, and fail loudly in development if they don't.
- Confirm that colour textures use sRGB and data textures (normal, roughness, AO) stay linear.

## Common mistakes to avoid
- Shipping 4K PNG textures (they expand to full RGBA in GPU memory).
- Root motion left in the walk clip (causes double movement, because code moves the character).
- Unapplied scale (the model imports 100× too large or small, and the lightmap texel density is wrong).
- Simplifying skinned meshes without checking the deformation.
- Lightmaps without a second UV set, or with overlapping UVs.
- Missing attribution for CC-BY assets.

## How to verify
1. Compare the before and after `inspect` output, and record both in the register.
2. Check that size is within the tier budget for every variant.
3. Load the asset in the chapter's isolation mode at all tiers: no console warnings, the correct colour space, no missing textures, and correct node and clip names.
4. For characters, scrub the walk forward and backward and check that there is no foot sliding or popping.
5. Check `renderer.info.memory` before and after the chapter to confirm disposal.
