import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createHoloScreenMaterial } from '../../shaders/holoScreen.ts';
import { acquireAtlas, retainAtlas } from './atlasCache.ts';
import type { AtlasFactory } from './atlasCache.ts';
import { createHoloGeometry } from './geometry.ts';
import type { AtlasSize, Pane } from './panes.ts';

/**
 * A set of floating screens, as in science fiction films (Raju, 2026-11-28; they replaced boxed
 * monitors at the desk and screens set into the cockpit dash): layers of clear glass and bare light
 * at different depths. Their motion is ambient, on the wall clock; only `open` (0 folded away, 1
 * open) carries story state, written by the chapter from its own story time.
 */
interface HoloPanesProps {
  /** `panes`, `size` and `createAtlas` are module constants: built once. */
  readonly panes: readonly Pane[];
  readonly size: AtlasSize;
  readonly createAtlas: AtlasFactory;
  readonly open?: { readonly current: number };
}

export function HoloPanes({ panes, size, createAtlas, open }: HoloPanesProps) {
  const low = useJourneyStore((s) => s.tier === 'low');
  // half the resolution (a quarter of the memory) on Low
  const scale = low ? 0.5 : 1;
  const atlas = useMemo(() => acquireAtlas(createAtlas, scale), [createAtlas, scale]);
  useEffect(() => retainAtlas(atlas), [atlas]);
  const geometry = useMemo(
    () => createHoloGeometry(low ? panes.filter((p) => !p.detail) : panes),
    [panes, low],
  );
  const material = useMemo(
    () => createHoloScreenMaterial(atlas.texture, size, low),
    [atlas, size, low],
  );
  useDisposeOnUnmount(geometry, material);

  useFrame(({ clock }) => {
    const { uTime, uOpen } = material.uniforms;
    if (uTime) uTime.value = clock.elapsedTime;
    if (uOpen) uOpen.value = open ? open.current : 1;
  });

  // before anything else made of light (the desk hologram, from renderOrder 1, stands in front)
  return <mesh geometry={geometry} material={material} renderOrder={0} />;
}
