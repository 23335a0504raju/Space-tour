import { useMemo } from 'react';
import { NasaCraft } from '../nasa/NasaModel.tsx';
import type { NasaModelKey } from '../nasa/NasaModel.tsx';
import type { StationKind } from './jupiter.ts';
import { OrbitTrail, alongOrbit, orbitThrough } from './Orbits.tsx';

/**
 * Three real NASA spacecraft, one per flagship project (public-domain models, assets A031–A033).
 * Each craft is chosen because what it does matches what the project does (src/content/projects.ts):
 *  - SmartWay Traffic: Landsat 8, an Earth-observation satellite that images the ground
 *    (the project detects and manages road traffic from camera vision),
 *  - DocumentDB: Voyager, which carries the Golden Record, a stored archive of human knowledge
 *    (the project stores documents and retrieves them by meaning),
 *  - Stash: Juno, whose electronics sit inside a titanium radiation vault
 *    (the project is a place where saved things are kept).
 * Each flies along its own orbit with a light trail behind it (Orbits.tsx); `tilt` is now the
 * craft's attitude within that flight frame, so every craft is held in a deliberate, ordered pose.
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
  const craft = CRAFT[kind];
  const heading = useMemo(() => alongOrbit(orbitThrough(position)), [position]);
  return (
    <>
      <OrbitTrail station={position} />
      <group position={[...position]}>
        <pointLight position={[0, 4, 9]} intensity={60} distance={30} color="#dbe6ff" />
        <group rotation={heading}>
          <group rotation={craft.tilt}>
            <NasaCraft model={craft.model} size={craft.size} />
          </group>
        </group>
      </group>
    </>
  );
}
