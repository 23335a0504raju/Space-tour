import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createFaceHologramMaterial } from '../../shaders/faceHologram.ts';
import {
  createBeamMaterial,
  createEmitterMaterial,
  createMoteMaterial,
  moteGeometry,
} from '../../shaders/projector.ts';
import { ROOM_PHOTOS } from './assets.ts';
import { DESK, FACE_HOLOGRAM, SEAT } from './layout.ts';

/**
 * Raju on the desk (SC02/SC03): a small projector right of the keyboard throwing a hologram of him
 * that faces the astronaut (A062). Its motion (float, sway, scan, motes) is ambient, on the wall
 * clock, so it carries no story state.
 */

/** The figure (a 640×720 cut-out), floating just over the projector. */
const FIGURE = { width: 0.48, height: 0.54, lift: 0.07 } as const;
/**
 * It faces the astronaut's seat, but turns no further than this from the camera (radians): the
 * camera sits behind them, and a flat picture seen edge-on would show nothing.
 */
const MAX_OFF_CAMERA = 0.72;
const TO_SEAT = Math.atan2(SEAT[0] - FACE_HOLOGRAM.x, SEAT[2] - FACE_HOLOGRAM.z);
const PUCK_TOP = 0.024;
const EMITTER_SIZE = 0.36;
/** The light from the projector reaches well up into the figure's dissolving waist. */
const BEAM = { bottom: 0.054, top: 0.23, height: 0.27 } as const;

export function Hologram() {
  const gl = useThree((s) => s.gl);
  const map = useLoader(getKTX2Loader(gl), ROOM_PHOTOS.hologram);
  const low = useJourneyStore((s) => s.tier === 'low');
  const figure = useRef<THREE.Mesh>(null);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const kit = useMemo(
    () => ({
      figure: new THREE.PlaneGeometry(FIGURE.width, FIGURE.height),
      figureMaterial: createFaceHologramMaterial(map, low),
      emitter: new THREE.PlaneGeometry(EMITTER_SIZE, EMITTER_SIZE),
      emitterMaterial: createEmitterMaterial(EMITTER_SIZE, low ? 0.6 : 1),
      beam: new THREE.CylinderGeometry(BEAM.top, BEAM.bottom, BEAM.height, low ? 20 : 32, 1, true),
      beamMaterial: createBeamMaterial(low ? 0.55 : 1),
      motes: moteGeometry(low ? 0 : 38),
      moteMaterial: createMoteMaterial(),
    }),
    [map, low],
  );
  useDisposeOnUnmount(
    kit.figure,
    kit.figureMaterial,
    kit.emitter,
    kit.emitterMaterial,
    kit.beam,
    kit.beamMaterial,
    kit.motes,
    kit.moteMaterial,
  );

  useFrame(({ camera, clock, size, viewport }) => {
    const mesh = figure.current;
    if (!mesh?.parent) return;
    const time = clock.elapsedTime;
    mesh.parent.worldToLocal(eye.copy(camera.position));
    const toCamera = Math.atan2(eye.x, eye.z);
    // a slow float and sway, so it never stands still
    mesh.rotation.y =
      THREE.MathUtils.clamp(TO_SEAT, toCamera - MAX_OFF_CAMERA, toCamera + MAX_OFF_CAMERA) +
      0.025 * Math.sin(time * 0.7);
    mesh.position.y = FIGURE.lift + FIGURE.height / 2 + 0.007 * Math.sin(time * 1.25);
    for (const m of [kit.figureMaterial, kit.emitterMaterial, kit.beamMaterial, kit.moteMaterial]) {
      const u = m.uniforms['uTime'];
      if (u) u.value = time;
    }
    const height = kit.moteMaterial.uniforms['uHeight'];
    if (height) height.value = size.height * viewport.dpr;
  });

  return (
    <group position={[FACE_HOLOGRAM.x, DESK.top, FACE_HOLOGRAM.z]}>
      {/* the projector */}
      <mesh position={[0, PUCK_TOP / 2, 0]}>
        <cylinderGeometry args={[0.072, 0.084, PUCK_TOP, 28]} />
        <meshStandardMaterial color="#23272e" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh
        geometry={kit.emitter}
        material={kit.emitterMaterial}
        position={[0, PUCK_TOP + 0.0015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      />
      <mesh
        geometry={kit.beam}
        material={kit.beamMaterial}
        position={[0, PUCK_TOP + BEAM.height / 2, 0]}
        renderOrder={2}
      />
      <mesh
        ref={figure}
        geometry={kit.figure}
        material={kit.figureMaterial}
        position={[0, FIGURE.lift + FIGURE.height / 2, 0]}
        renderOrder={3}
      />
      {/* dust in the light (left out on Low); its points are placed in the shader */}
      {!low && (
        <points
          geometry={kit.motes}
          material={kit.moteMaterial}
          frustumCulled={false}
          renderOrder={4}
        />
      )}
    </group>
  );
}
