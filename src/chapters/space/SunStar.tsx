import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createCoronaMaterial, createSunMaterial } from '../../shaders/sun.ts';

function glowTexture(size: number, stops: readonly [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = textureContext(c)!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Corona quad half-size, in Sun radii (flames and prominences reach well past the limb). */
const CORONA_EXTENT = 1.9;

/**
 * The Sun as a body (Raju's reference, 2026-11-25): a boiling red-orange photosphere with bright
 * active regions and dark filaments (src/shaders/sun.ts), a ragged flame fringe with prominences
 * on a camera-facing quad, and a soft warm glow. One Sun for the whole journey (Raju, 2026-11-27:
 * the sunrise showed a white point, unlike the solar-system view). Surface motion is ambient (clock
 * time); the owner places it. Depth-tested, so a planet in front hides it.
 */
export function SunStar({ radius }: { radius: number }) {
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const { surface, corona, glow } = useMemo(
    () => ({
      surface: createSunMaterial(low),
      corona: createCoronaMaterial(low, CORONA_EXTENT),
      glow: glowTexture(256, [
        [0, 'rgba(255,110,30,0.3)'],
        [0.25, 'rgba(255,80,15,0.1)'],
        [0.55, 'rgba(255,60,10,0.025)'],
        [1, 'rgba(255,50,10,0)'],
      ]),
    }),
    [low],
  );
  useDisposeOnUnmount(surface, corona, glow);
  const fringe = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    surface.uniforms['uTime']!.value = t;
    corona.uniforms['uTime']!.value = t;
    // the fringe faces the camera's position (not its view direction: off-axis the disc and the
    // flames drifted apart into a crescent)
    fringe.current?.lookAt(camera.position);
  });
  return (
    <>
      <mesh material={surface}>
        <sphereGeometry args={[radius, low ? 48 : 96, low ? 32 : 64]} />
      </mesh>
      <mesh ref={fringe} material={corona}>
        <planeGeometry args={[radius * CORONA_EXTENT * 2, radius * CORONA_EXTENT * 2]} />
      </mesh>
      <sprite scale={[radius * 9, radius * 9, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
    </>
  );
}
