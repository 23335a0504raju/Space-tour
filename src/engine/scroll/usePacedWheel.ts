import { useEffect } from 'react';
import gsap from 'gsap';
import { PACING, clampLead, follow, wheelStep } from './pacing.ts';

/**
 * Desktop wheel/trackpad governor. Touch, keyboard, scrollbar drags and programmatic jumps stay
 * native: we only follow them (when the page moves by itself, the target re-syncs to it). Runs on
 * the GSAP ticker, the one clock. Disabled for reduced motion, where the journey is a photo story.
 */
export function usePacedWheel(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let target = window.scrollY;
    let last = window.scrollY;
    let lastWheel = 0;
    const max = () => document.documentElement.scrollHeight - window.innerHeight;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      // a modal (Project Bay) scrolls itself; the page must stay where it is
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      // someone else moved the page (keyboard, jump): start from where it really is
      if (Math.abs(window.scrollY - last) > 2) target = window.scrollY;
      target = Math.min(max(), Math.max(0, target + wheelStep(e.deltaY, e.deltaMode, innerHeight)));
      target = clampLead(window.scrollY, target);
      lastWheel = performance.now();
    };
    const tick = () => {
      // wheel went quiet: drop whatever lead is left, so nothing drains after input ends
      if (target !== window.scrollY && performance.now() - lastWheel > PACING.idleMs) {
        target = window.scrollY;
        return;
      }
      if (Math.abs(window.scrollY - last) > 2) {
        target = window.scrollY;
        last = window.scrollY;
        return;
      }
      if (target === window.scrollY) return;
      const next = follow(window.scrollY, target, gsap.ticker.deltaRatio());
      window.scrollTo({ top: next, behavior: 'instant' });
      last = window.scrollY;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    gsap.ticker.add(tick);
    return () => {
      window.removeEventListener('wheel', onWheel);
      gsap.ticker.remove(tick);
    };
  }, [enabled]);
}
