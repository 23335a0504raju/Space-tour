import { useEffect } from 'react';
import gsap from 'gsap';
import { admitWheel, chargeBurst, clampLead, createBurst, follow, wheelStep } from './pacing.ts';

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
    const burst = createBurst();
    const max = () => document.documentElement.scrollHeight - window.innerHeight;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      // a modal (Project Bay) scrolls itself; the page must stay where it is
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      const vh = window.innerHeight;
      // a fling that has already carried about one chapter: ignore the rest of its momentum
      if (!admitWheel(burst, performance.now(), vh)) return;
      // someone else moved the page (keyboard, jump): start from where it really is
      if (Math.abs(window.scrollY - last) > 2) target = window.scrollY;
      target = Math.min(max(), Math.max(0, target + wheelStep(e.deltaY, e.deltaMode, vh)));
      target = clampLead(window.scrollY, target, vh);
    };
    const tick = () => {
      if (Math.abs(window.scrollY - last) > 2) {
        target = window.scrollY;
        last = window.scrollY;
        return;
      }
      if (target === window.scrollY) return;
      const vh = window.innerHeight;
      const next = follow(window.scrollY, target, gsap.ticker.deltaRatio());
      chargeBurst(burst, next - window.scrollY, target - window.scrollY, vh);
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
