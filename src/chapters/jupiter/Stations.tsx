import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { NasaCraft } from '../nasa/NasaModel.tsx';
import type { NasaModelKey } from '../nasa/NasaModel.tsx';
import type { StationKind } from './jupiter.ts';

/**
 * Three real NASA spacecraft, one per flagship project (public-domain models, assets A031–A033).
 * Each craft is chosen because what it does matches what the project does (src/content/projects.ts):
 *  - SmartWay Traffic: Landsat 8, an Earth-observation satellite that images the ground
 *    (the project detects and manages road traffic from camera vision),
 *  - DocumentDB: Voyager, which carries the Golden Record, a stored archive of human knowledge
 *    (the project stores documents and retrieves them by meaning),
 *  - Stash: Juno, whose electronics sit inside a titanium radiation vault
 *    (the project is a place where saved things are kept).
 * Spin is ambient (clock time); it carries no story meaning.
 */
const CRAFT: Record<
  StationKind,
  { readonly model: NasaModelKey; readonly size: number; readonly tilt: [number, number, number] }
> = {
  traffic: { model: 'landsat8', size: 10, tilt: [0.5, 0.4, 0.2] },
  documents: { model: 'voyager', size: 10, tilt: [0.3, 0, 0.35] },
  vault: { model: 'juno', size: 12, tilt: [0.15, 0, 0.4] },
};

export function Station({
  kind,
  position,
}: {
  readonly kind: StationKind;
  readonly position: readonly [number, number, number];
}) {
  const spin = useRef<THREE.Group>(null);
  const craft = CRAFT[kind];
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.1;
  });
  return (
    <group position={[...position]}>
      <pointLight position={[0, 4, 9]} intensity={60} distance={30} color="#dbe6ff" />
      <group ref={spin} rotation={craft.tilt}>
        <NasaCraft model={craft.model} size={craft.size} />
      </group>
    </group>
  );
}
