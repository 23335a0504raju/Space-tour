import type * as THREE from 'three';

/**
 * One atlas per set and resolution, shared by every mounted copy (SC02 and SC03 each mount the desk)
 * and freed when the last one leaves.
 */
export type AtlasFactory = (scale: number) => THREE.CanvasTexture;

export interface SharedAtlas {
  readonly texture: THREE.CanvasTexture;
  readonly factory: AtlasFactory;
  readonly scale: number;
}

const cache = new Map<AtlasFactory, Map<number, SharedAtlas>>();
const users = new WeakMap<SharedAtlas, number>();

/** The atlas for a user about to mount (drawn on first use). */
export function acquireAtlas(factory: AtlasFactory, scale: number): SharedAtlas {
  let byScale = cache.get(factory);
  if (!byScale) cache.set(factory, (byScale = new Map()));
  let atlas = byScale.get(scale);
  if (!atlas) byScale.set(scale, (atlas = { texture: factory(scale), factory, scale }));
  return atlas;
}

/**
 * Counts a mounted user; the returned function (an effect cleanup) lets it go. The texture is freed
 * in the next task if no user is left by then (StrictMode runs cleanups and effects twice with the
 * same objects; see engine/lifecycle.ts).
 */
export function retainAtlas(atlas: SharedAtlas): () => void {
  users.set(atlas, (users.get(atlas) ?? 0) + 1);
  return () => {
    users.set(atlas, (users.get(atlas) ?? 1) - 1);
    setTimeout(() => {
      if ((users.get(atlas) ?? 0) > 0) return;
      const byScale = cache.get(atlas.factory);
      if (byScale?.get(atlas.scale) === atlas) byScale.delete(atlas.scale);
      atlas.texture.dispose();
    }, 0);
  };
}
