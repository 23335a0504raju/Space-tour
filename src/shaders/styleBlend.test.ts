import { ToneMappingMode } from 'postprocessing';
import type { Effect } from 'postprocessing';
import { describe, expect, it } from 'vitest';
import { LensEffect } from './lens.ts';
import { OrderedToneMappingEffect, StyleBlendEffect } from './styleBlend.ts';

/** postprocessing's own ordering of the effects in one pass (EffectPass.setEffects). */
const inPassOrder = (effects: Effect[]) =>
  [...effects].sort((a, b) => b.getAttributes() - a.getAttributes());

describe('the style pass', () => {
  it('stays after the lens and tone mapping, though it reads depth', () => {
    // run before tone mapping, it turned every painted colour grey
    const written = [
      new LensEffect(),
      new OrderedToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new StyleBlendEffect(),
    ];
    expect(inPassOrder(written)).toEqual(written);
  });
});
