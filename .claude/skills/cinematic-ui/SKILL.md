---
name: cinematic-ui
description: Build the DOM layers of the space portfolio. Covers cinematic typography, chapter overlays and title cards, world-anchored labels, Project Bay, persistent navigation (Resume, Mission Brief, Flight Plan menu), transitions, responsive layouts, reduced-motion photo-story mode, keyboard and screen-reader accessibility, and the static Mission Brief page. Use it whenever a task touches HTML/CSS, visible text, navigation, the content module, or accessibility.
---

# Cinematic UI and accessibility

The art direction is in `docs/PROJECT_VISION.md` §3. The accessibility rules are in `docs/PERFORMANCE_ACCESSIBILITY.md` §5.

## Inspect before changing anything
1. Read the chapter's storyboard entry to see what text appears, where, and at which rest point.
2. Open `src/content/` and use only **verified** entries. If a needed fact is missing or still a placeholder, **stop and ask the user**. Never invent or embellish personal information, metrics or achievements.
3. Check the design tokens (colours, type scale, spacing, motion durations) and the existing overlay components in `src/overlays/`. Reuse them before creating new ones.
4. Check the art-style profile of the chapter, because anime-styled chapters may use a different overlay treatment defined in the look-dev sheet.

## Visual rules (from Batch 1)
- Use an instrument-grade interface: monochrome, thin rules, small caps and tabular figures for data, and **one accent colour**.
- Avoid neon, glowing cards, glassmorphism, gradients-for-decoration, game HUD elements, and floating text boxes in empty space.
- Use at most two font families, with fluid type via `clamp()`.
- Show a headline plus at most 2–4 short lines per rest point. Depth belongs in Project Bay and Mission Brief.
- Every text block sits on an adaptive scrim, so it reaches WCAG AA contrast against the brightest and darkest frame behind it.

## Behaviour rules
- Story-timed DOM animation goes in the **overlay GSAP timeline**, seeked from master progress, so it reverses exactly. Never use CSS transitions or framer-motion for story-timed elements. Hover and focus micro-interactions may use CSS.
- **Persistent UI** (name, Resume, Mission Brief, Menu, progress and current destination) is always reachable, including during loading and inside Project Bay.
- **World-anchored labels** are positioned by direct style writes from the render loop, never through React state.
- **Project Bay** is a dialog: it traps focus, Esc closes it, focus returns to the opener, the master progress is restored exactly, and scroll is inert while it is open.
- The **Flight Plan menu** lists chapters from the registry (never hard-coded) and uses the chapter-jump procedure.
- Diegetic screens (cockpit, spectrometer) render from the same content data as the DOM copy, so they never diverge.

## Accessibility checklist (apply on every change)
- [ ] The canvas is `aria-hidden`. A visually hidden, ordered outline of all chapter content exists in the DOM.
- [ ] A skip link to Mission Brief and Contact is the first focusable element.
- [ ] Headings are in a logical order, and links are real `<a>` elements with descriptive text (no "click here").
- [ ] Focus is visible on every interactive element. Touch targets are at least 44 px.
- [ ] Chapter changes are announced politely (one `aria-live="polite"` region, with short messages).
- [ ] `prefers-reduced-motion` gives the photo-story mode (stills + crossfades) or the Brief. There is no shake, parallax or flashing.
- [ ] Nothing flashes more than 3 times per second.
- [ ] Text is still usable at 200% zoom, and content is never only inside WebGL textures.

## Mission Brief
- Mission Brief is a separate entry that is **prerendered to static HTML** from the same content module, with no Three.js or GSAP in its bundle. It must work with JavaScript disabled.
- It contains everything: identity, education, experience, projects (links and images), stack, learning, future direction, contact and resume.
- Its section anchors match the chapter IDs, so deep links work in both directions.
- Use semantic HTML, print-friendly CSS, and include metadata (title, description, Open Graph).

## Responsive
- Overlay layouts are defined per aspect class (portrait, landscape, ultrawide), not just shrunk.
- Use `dvh`/`svh` carefully: overlays use stable units so the mobile address bar doesn't shift text mid-read.

## Common mistakes to avoid
- Personal content hard-coded in components instead of `src/content/`.
- Text that appears during fast camera motion.
- Using `display: none` toggles driven by scroll callbacks (these are direction-dependent). Use timeline-driven `autoAlpha` instead.
- Modal overlays without a focus trap, or that leave the background scrollable.
- Logos and skill-percentage bars (rejected in Batch 1 and Batch 2).

## How to verify
1. Run axe-core (Playwright) at every rest point and on the Brief: zero violations.
2. Do a keyboard-only pass through the chapter: all controls are reachable, and Esc and focus return work.
3. Run Lighthouse on the Brief (targets in the performance doc).
4. Compare forward and reverse screenshots of overlays at each rest point.
5. Check text contrast against the brightest and darkest background frames (sample the pixels behind each text box).
6. Spot-check with a screen reader (NVDA on Windows).
