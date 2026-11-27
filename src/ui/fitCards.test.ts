import { describe, expect, it } from 'vitest';
import { MIN_FIT, nextFit } from './fitCards.ts';

describe('card fitting', () => {
  it('leaves a card that already fits at full size', () => {
    expect(nextFit(1, 400, 500)).toBe(1);
    expect(nextFit(1, 500, 500)).toBe(1);
  });
  it('shrinks a tall card enough to fit', () => {
    const k = nextFit(1, 800, 600);
    expect(k).toBeLessThan(1);
    expect(800 * k).toBeLessThanOrEqual(600);
  });
  it('never goes below the readable minimum', () => {
    expect(nextFit(1, 3000, 400)).toBe(MIN_FIT);
  });
  it('ignores a card with no size yet', () => {
    expect(nextFit(1, 0, -20)).toBe(1);
  });
});
