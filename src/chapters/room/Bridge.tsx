import { useEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getKTX2Loader, gltfExtender } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { BRIDGE } from './layout.ts';

/**
 * The launch-control bridge around the developer's desk (SC02/SC03): "SF bridge console /
 * 科幻風艦橋" by 林柏勳 (Lin), Sketchfab, CC BY 4.0 (asset A036; credit in the Mission Brief).
 * Optimised by `node scripts/optimize-bridge.ts`: an opaque shell material and a transparent
 * hologram material (the globe and its rings).
 *
 * The hologram's rotation clip is ambient motion (wall-clock time), like the typing loop: it carries
 * no story meaning, so it may run on the clock without breaking reverse scrolling.
 */
export const BRIDGE_URL = '/assets/models/bridge.glb';

/** The globe shows Earth (NASA Blue Marble, A021), not the model author's reddish planet. */
const EARTH_MAP = '/assets/textures/earth_day_2k.ktx2';
/** The globe's mesh in the model (a 151-vertex sphere; the other hologram parts are glow shells). */
const GLOBE_MESH = 'Object012';
/** +1 when the mesh's +Z pole is north (checked in the render). */
const POLE_SIGN = 1;
/** Cool hologram tint over the Earth map. */
const GLOBE_TINT = '#a9cfff';

/**
 * Equirectangular UVs for a low-poly sphere, per triangle: the model's own UVs address the author's
 * atlas. Triangles that cross the texture seam get their u values unwrapped (the texture repeats in
 * S) and pole vertices take the mean u of their triangle, so neither smears the map.
 * KTX2 textures are not flipped: v = 0 is the top row, which is north.
 */
function sphericalUvs(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = source.toNonIndexed();
  const pos = g.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let t = 0; t < pos.count; t += 3) {
    const u = [0, 0, 0];
    const v = [0, 0, 0];
    const pole = [false, false, false];
    for (let k = 0; k < 3; k += 1) {
      const x = pos.getX(t + k);
      const y = pos.getY(t + k);
      const z = pos.getZ(t + k);
      const r = Math.hypot(x, y, z) || 1;
      // the model spins this sphere about its local Z axis (the clip), so Z is the pole axis
      u[k] = Math.atan2(y, x) / (2 * Math.PI) + 0.5;
      v[k] = 0.5 - (Math.asin(THREE.MathUtils.clamp(z / r, -1, 1)) / Math.PI) * POLE_SIGN;
      pole[k] = Math.abs(z / r) > 0.999;
    }
    const rim = [0, 1, 2].filter((k) => !pole[k]);
    if (rim.length >= 2) {
      const us = rim.map((k) => u[k] ?? 0);
      if (Math.max(...us) - Math.min(...us) > 0.5)
        for (const k of rim) if ((u[k] ?? 0) < 0.5) u[k] = (u[k] ?? 0) + 1;
      const mean = rim.reduce((a, k) => a + (u[k] ?? 0), 0) / rim.length;
      for (let k = 0; k < 3; k += 1) if (pole[k]) u[k] = mean;
    }
    for (let k = 0; k < 3; k += 1) {
      uv[(t + k) * 2] = u[k] ?? 0;
      uv[(t + k) * 2 + 1] = v[k] ?? 0;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Multiplied into the shell's (pale tile) colour map: dark deck and walls, glow panels untouched. */
const SHELL_TINT = '#5d646f';

export function Bridge() {
  const gl = useThree((s) => s.gl);
  const { scene, animations } = useGLTF(BRIDGE_URL, false, true, gltfExtender(gl));
  const earth = useLoader(getKTX2Loader(gl), EARTH_MAP);

  const {
    model,
    owned: disposables,
    mixer,
  } = useMemo(() => {
    const c = scene.clone(true);
    const owned: Array<{ dispose(): void }> = [];
    const swap = new Map<THREE.Material, THREE.Material>();
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      let mat = swap.get(src);
      if (!mat) {
        const copy = src.clone();
        if (src.name === 'Bridge_Shell') copy.color.set(SHELL_TINT);
        else copy.depthWrite = false; // hologram: transparent glass over the deck
        swap.set(src, copy);
        owned.push(copy);
        mat = copy;
      }
      m.material = mat;
      m.receiveShadow = true;
      if (m.name.startsWith(GLOBE_MESH)) {
        // the planet: Earth on its own geometry and material (the cached glTF is shared)
        const map = earth.clone();
        map.wrapS = THREE.RepeatWrapping;
        map.needsUpdate = true;
        const globe = new THREE.MeshBasicMaterial({
          map,
          color: GLOBE_TINT,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
        });
        m.geometry = sphericalUvs(m.geometry);
        m.material = globe;
        owned.push(map, globe, m.geometry);
      }
    });
    const mx = new THREE.AnimationMixer(c);
    return { model: c, owned, mixer: mx };
  }, [scene, earth]);
  useDisposeOnUnmount(...disposables);
  // start and stop in the same effect (StrictMode's simulated unmount would otherwise stop the
  // spin for good)
  useEffect(() => {
    for (const clip of animations) mixer.clipAction(clip).play();
    return () => void mixer.stopAllAction();
  }, [mixer, animations]);

  useFrame((_, delta) => mixer.update(delta));

  return (
    <primitive
      object={model}
      position={BRIDGE.position}
      rotation={[0, BRIDGE.rotationY, 0]}
      scale={BRIDGE.scale}
    />
  );
}
