import { describe, expect, it, vi } from 'vitest';

// The single clock: GSAP ticker → R3F advance(). R3F (frameloop "never") stores the value passed
// to advance() as clock.elapsedTime, so it must be in seconds. Passing milliseconds made every
// ambient loop run 1000× too fast (the "typing is too fast" report, P4).
const advance = vi.fn();
let tick: ((time: number) => void) | undefined;

vi.mock('@react-three/fiber', () => ({ advance }));
vi.mock('gsap', () => ({
  default: {
    ticker: {
      add: (fn: (time: number) => void) => {
        tick = fn;
      },
      remove: () => undefined,
    },
  },
}));
vi.mock('react', () => ({ useEffect: (fn: () => void) => fn() }));

describe('engine clock', () => {
  it('passes GSAP ticker time to R3F in seconds, unchanged', async () => {
    const { useGsapDrivenFrames } = await import('./clock.ts');
    useGsapDrivenFrames();
    expect(tick).toBeTypeOf('function');
    tick?.(12.5);
    expect(advance).toHaveBeenCalledWith(12.5);
  });
});
