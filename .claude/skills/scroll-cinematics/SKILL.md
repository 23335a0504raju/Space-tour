---
name: scroll-cinematics
description: Author scroll-driven cinematic animation for the space portfolio with GSAP timelines and ScrollTrigger. Covers the master progress, chapter timelines, dwell zones, reversible animation, camera and character synchronisation, overlay text timing, chapter jumps, and the single-clock rule. Use it whenever a task creates or changes any timeline, scroll behaviour, transition, or what happens at a given point of the journey.
---

# Scroll cinematics: GSAP + ScrollTrigger

Core law: **one clock, one progress value, one animation system.** Scroll → ScrollTrigger → master progress p → seeked GSAP timelines → rig state → render.

## Inspect before changing anything
1. Read `docs/TECHNICAL_BLUEPRINT.md` §4 (scroll and timeline) and §8 (transitions).
2. Read `docs/STACK_DECISIONS.md` §3.6 to see which smoothing mode is active: native scroll with numeric `scrub`, **or** Lenis with `scrub: true`. Never both.
3. Open `src/engine/scroll/` and `src/engine/director/` and confirm how the master trigger, resolver and clock are currently wired.
4. Read the target chapter's timeline factory and its meta (scroll lengths, rest points).
5. Check GSAP and ScrollTrigger API details against gsap.com/docs, and Lenis against its README, if anything is unclear.

## Rules
- **Exactly one ScrollTrigger drives the journey:** a trigger on the invisible scroll track, with `start: "top top"` and `end: "bottom bottom"`. Chapters never create their own scroll-linked ScrollTriggers.
- **Chapter timelines are paused, have a total duration of 1, and are deterministic.** They only tween plain objects, meaning the rig state and the chapter's own refs. They must never tween React state or props.
- **No visual side effects in callbacks.** `onEnter`, `onLeave`, `onComplete` and `onUpdate` may only request loading, announce to ARIA or log. Anything visible must be a tween, or reversing will break.
- **Use `fromTo` for anything that starts mid-timeline.** Never rely on "current value" starts, because they record whatever the state was when the tween was first rendered, and that is direction-dependent. Use `immediateRender: false` where a later `fromTo` would otherwise overwrite earlier frames.
- **No randomness** inside timelines unless it is seeded and computed once at build time.
- **Dwell zones** are made by remapping local t (a flat band of the timeline), never by pinning or locking scroll.
- **Text appears at rest points, not during fast motion.** Overlay tweens belong to the overlay timeline, which is seeked from the same p in the same tick as the 3D timeline.
- **Durations are proportions.** Under scrub, a tween's duration is its share of the chapter, not seconds. Keep each chapter's scroll length in its meta, not in tween durations.
- **Chapter jump procedure:** fade out → ensure the target is warm → set scroll instantly → force the playhead to the target p, bypassing scrub smoothing → fade in. Never animate the scroll across chapters (this would load and render everything in between).
- **Clock:** R3F is advanced from `gsap.ticker` (or reads the rig state in a high-priority `useFrame`, whichever spike S1 confirmed). Do not add another `requestAnimationFrame` loop.
- **Mobile resize:** keep the track height in px from the large viewport, with `ignoreMobileResize` behaviour, so the address bar showing or hiding never re-maps progress.
- Use `gsap.matchMedia()` (not the deprecated `ScrollTrigger.matchMedia`) for reduced-motion and aspect variants. Use `useGSAP` for DOM-side cleanup.

## Character and camera synchronisation
- Both read from the same local t. The camera shot is sampled from its curve at t, and the astronaut's position on its path at t gives the distance, which gives the walk clip time.
- Clip blends (sit → stand → walk) are weight tweens in the timeline, so they reverse exactly.
- Hard cuts happen at an exact t declared in the chapter meta, and the camera director switches shots on that frame. There are no tweens across a cut.

## Common mistakes to avoid
- Combining Lenis smoothing with numeric `scrub` (double smoothing makes motion floaty and imprecise).
- Using framer-motion or CSS transitions for story-timed DOM elements (they can't be scrubbed or reversed).
- Using `.play()`, `.restart()` or `.reverse()` on chapter timelines (only ever seek).
- Using `ScrollTrigger.refresh()` in loops, or creating triggers in render bodies.
- Forgetting `invalidateOnRefresh` and invalidation for values computed from viewport size.
- Using `toggleActions` for story elements (that is play-based, not scrubbed).
- Text whose visibility depends on the previous scroll direction.

## Performance considerations
Seeking timelines is cheap. Expensive work happens in the tween targets, so keep the rig state flat and numeric. Don't query the DOM in `onUpdate`. Batch DOM writes for world-anchored labels once per tick.

## How to verify
1. Run the unit tests: resolver boundaries, the path-independence test (`seek a→b == seek b`) and the monotonic sweep test must pass.
2. Use the dev scrubber to jump randomly between t values and confirm the frames are identical to a slow scrub.
3. Run the Playwright reverse test: screenshots at every rest point on the forward pass match the backward pass within tolerance.
4. Run the chapter-jump test: the network log shows no requests for intermediate chapters.
5. Test on a real phone: no progress jump when the address bar collapses, and orientation change preserves p.
6. With reduced-motion emulation, the photo-story path is used and no tweened camera motion runs.
