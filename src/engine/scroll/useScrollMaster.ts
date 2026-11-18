import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
// Mobile address-bar show/hide must not re-map progress (STACK_DECISIONS.md §3.6).
ScrollTrigger.config({ ignoreMobileResize: true });

/** Plain mutable state, read by render loops. Never put this in React state. */
export interface ScrollMasterState {
  /** Smoothed master progress in [0, 1]: what the story is driven by. */
  progress: number;
  /** Raw scroll progress (unsmoothed), for diagnostics. */
  scrollProgress: number;
  /** gsap.ticker.frame on which `progress` last changed (single-clock sync check). */
  updatedOnFrame: number;
}

export interface ScrollMaster {
  readonly state: ScrollMasterState;
  /** Jump straight to a master progress, skipping scrub smoothing (TECHNICAL_BLUEPRINT.md §4.5). */
  jumpTo(progress: number): void;
  /** Scroll the page to a master progress (keyboard rest-point stepping). */
  scrollToProgress(progress: number, smooth: boolean): void;
}

export interface ScrollMasterOptions {
  /** Seconds the playhead takes to catch up with the scrollbar (the ONE smoothing layer). */
  readonly scrub: number;
}

/**
 * The only scroll-linked ScrollTrigger in the experience: a trigger on the invisible track
 * drives one paused tween of `state.progress` from 0 to 1.
 */
export function useScrollMaster(
  trackRef: RefObject<HTMLElement | null>,
  { scrub }: ScrollMasterOptions,
): ScrollMaster {
  const stateRef = useRef<ScrollMasterState>({
    progress: 0,
    scrollProgress: 0,
    updatedOnFrame: -1,
  });
  const triggerRef = useRef<ScrollTrigger | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const state = stateRef.current;

    const timeline = gsap.timeline({ paused: true });
    timeline.to(state, {
      progress: 1,
      duration: 1,
      ease: 'none',
      onUpdate: () => {
        state.updatedOnFrame = gsap.ticker.frame;
      },
    });

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub,
      animation: timeline,
      onUpdate: (self) => {
        state.scrollProgress = self.progress;
      },
    });

    triggerRef.current = trigger;
    timelineRef.current = timeline;
    return () => {
      trigger.kill();
      timeline.kill();
      triggerRef.current = null;
      timelineRef.current = null;
    };
  }, [trackRef, scrub]);

  const jumpTo = useCallback((progress: number) => {
    const trigger = triggerRef.current;
    const timeline = timelineRef.current;
    if (!trigger || !timeline) return;
    const p = Math.min(1, Math.max(0, progress));
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * p,
      behavior: 'instant',
    });
    ScrollTrigger.update();
    // Finish the scrub catch-up tween immediately so intermediate chapters are never rendered.
    const scrubTween = trigger.getTween();
    if (scrubTween) scrubTween.progress(1);
    timeline.progress(p);
  }, []);

  const scrollToProgress = useCallback((progress: number, smooth: boolean) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const p = Math.min(1, Math.max(0, progress));
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * p,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);

  // Stable identity: consumers put this in effect/callback deps. (A fresh object per render
  // caused an infinite update loop via the store's navigate callback; found in P2 e2e.)
  const state = stateRef.current;
  return useMemo(() => ({ state, jumpTo, scrollToProgress }), [state, jumpTo, scrollToProgress]);
}
