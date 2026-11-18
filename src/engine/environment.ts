import type * as THREE from 'three';

/**
 * Environment (image-based lighting) registry. Chapters load their environment map and register
 * it under a key; the Director applies the active chapter's environment. Neighbouring chapters are
 * mounted at the same time, so a chapter must never set scene.environment itself.
 */
const environments = new Map<string, THREE.Texture>();

export function registerEnvironment(key: string, texture: THREE.Texture): () => void {
  environments.set(key, texture);
  return () => {
    if (environments.get(key) === texture) environments.delete(key);
  };
}

export function getEnvironment(key: string | undefined): THREE.Texture | null {
  return key ? (environments.get(key) ?? null) : null;
}
