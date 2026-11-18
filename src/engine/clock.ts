import { useEffect } from 'react';
import gsap from 'gsap';
import { advance } from '@react-three/fiber';

/**
 * Single clock: R3F renders from GSAP's ticker (use with <Canvas frameloop="never">).
 * GSAP updates its root timeline before calling added listeners, so every render sees the
 * timeline state of the same tick. Spike S1 measures this ("same-frame" ratio).
 */
export function useGsapDrivenFrames(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    // GSAP's ticker time is in seconds. With frameloop "never", R3F stores the value passed to
    // advance() directly as clock.elapsedTime (and derives delta from it), so it must stay in
    // seconds. Passing milliseconds made every ambient loop run 1000× too fast: the typing
    // animation was sampled at random poses and looked frantic (user report, P4).
    const tick = (time: number) => advance(time);
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [enabled]);
}
