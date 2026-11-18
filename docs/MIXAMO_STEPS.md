# Getting the astronaut from Adobe Mixamo (your part, about 15 minutes)

You chose the Mixamo route (2026-11-16). Mixamo needs **your** free Adobe login, so I can't do these downloads myself. Once the files are in place I handle the rest: conversion to GLB, compression, foot-locked walking and wiring into SC02–SC04.

## 1. Sign in
1. Open **https://www.mixamo.com** and sign in (a free Adobe account is enough).

## 2. Choose the character
1. Open the **Characters** tab and search **"astronaut"**.
2. If there is a spacesuit character, pick it. If not, tell me and pick the closest suit-like or neutral full-body character (no visible face is ideal, since the plan is a faceless gold visor; I can add or replace the helmet in code).
3. Click **Download** with these settings:
   - Format: **FBX Binary (.fbx)**
   - Pose: **T-pose**
4. Save it as **`character.fbx`**.

## 3. Download the animations
For each animation: search its name in the **Animations** tab, click it, and check it plays on your character. Then click **Download** with:
- Format: **FBX Binary (.fbx)**
- Skin: **Without Skin** (the character file already has the skin)
- Frames per second: **30**
- Keyframe reduction: **none**

| Search for | Extra setting | Save as | Used for |
|---|---|---|---|
| Typing | — | `typing.fbx` | SC02: working at the desk |
| Sitting Idle | — | `sit-idle.fbx` | SC02/SC04: seated breathing |
| Stand Up (standing up from sitting) | — | `stand-up.fbx` | SC03: leaving the desk |
| Walking | ✅ tick **In Place** | `walk.fbx` | SC03: walk to the door |
| Breathing Idle | — | `idle.fbx` | SC13: standing on the hull |
| Sitting Down / Sit | — | `sit-down.fbx` | SC04: taking the seat |

If an exact name isn't there, pick the closest match and tell me which one you used. **"In Place" on Walking matters**: without it the character moves on its own and fights the scroll-driven movement.

## 4. Put the files here
Create the folder **`C:\projects\Portfolio\raw-assets\mixamo\`** and put all 7 `.fbx` files in it. That folder is gitignored, so raw Mixamo files are never committed.

Then tell me "Mixamo files are in". I'll:
1. Ask you to approve downloading **FBX2glTF** (a command-line converter, no Blender) and convert the files.
2. Merge the animations into one compressed GLB (Meshopt + KTX2), and check bones and clip names.
3. Replace the white stand-in in SC02, SC03 and SC04, reusing the foot-locked, reversible walk proven in spike S2.

## Licence note
Mixamo characters and animations are free to use in personal and commercial projects, including websites. What isn't allowed is redistributing the raw Mixamo files as standalone assets. We only ship a converted model embedded in the site, never the FBX files. It will be recorded in `assets/ASSET_REGISTER.md` like every other asset.
