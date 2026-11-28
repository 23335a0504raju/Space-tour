import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createHoloGlobeMaterial } from '../../shaders/holoGlobe.ts';
import type { Vec3 } from './panes.ts';

/** The day map the ascent also uses (A013), already in the first download. */
const MAP = '/assets/textures/earth_day_2k.ktx2';

/** A turning Earth of light. Its turn is ambient (wall clock); `open` is the story value. */
export function HoloGlobe({
  position,
  radius,
  open,
}: {
  position: Vec3;
  radius: number;
  open: { readonly current: number };
}) {
  const gl = useThree((s) => s.gl);
  const map = useLoader(getKTX2Loader(gl), MAP);
  const low = useJourneyStore((s) => s.tier === 'low');
  const mesh = useRef<THREE.Mesh>(null);
  const kit = useMemo(
    () => ({
      geometry: new THREE.SphereGeometry(radius, low ? 32 : 48, low ? 20 : 32),
      material: createHoloGlobeMaterial(map, low),
    }),
    [map, radius, low],
  );
  useDisposeOnUnmount(kit.geometry, kit.material);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const time = kit.material.uniforms['uTime'];
    const shown = kit.material.uniforms['uOpen'];
    if (time) time.value = clock.elapsedTime;
    if (shown) shown.value = open.current;
    m.rotation.y = clock.elapsedTime * 0.22;
    m.scale.setScalar(0.4 + 0.6 * THREE.MathUtils.smoothstep(open.current, 0, 1));
    m.visible = open.current > 0.001;
  });

  return (
    <mesh
      ref={mesh}
      geometry={kit.geometry}
      material={kit.material}
      position={[...position]}
      rotation={[0.35, 0, 0.2]}
      renderOrder={1}
    />
  );
}
