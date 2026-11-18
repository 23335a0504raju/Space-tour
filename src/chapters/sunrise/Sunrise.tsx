import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createAtmosphereMaterial, createEarthMaterial } from '../../shaders/earth.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import {
  EARTH,
  MOON,
  SUN_DISTANCE,
  engineLevel,
  shipDrift,
  shipYaw,
  sunDirection,
  sunLight,
  sunriseShot,
} from './sunrise.ts';

/** SC06 · Orbital Sunrise (FINAL_STORYLINE SC06). Public-domain NASA textures (A021–A023). */
const TEX = {
  day: '/assets/textures/earth_day_2k.ktx2',
  night: '/assets/textures/earth_night_2k.ktx2',
  moon: '/assets/textures/moon_1k.ktx2',
} as const;

const ENGINE = { current: 0 };
const dir: [number, number, number] = [0, 0, -1];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.08, 'rgba(255,244,220,0.7)');
    r.addColorStop(0.3, 'rgba(255,200,140,0.1)');
    r.addColorStop(0.65, 'rgba(255,170,100,0.02)');
    r.addColorStop(1, 'rgba(255,160,90,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    // dither: 8-bit gradients band into visible rings under additive blending
    const img = g.getImageData(0, 0, 256, 256);
    const rnd = seeded(7);
    for (let i = 3; i < img.data.length; i += 4) {
      const a = img.data[i] ?? 0;
      if (a > 0) img.data[i] = Math.min(255, Math.max(0, a + (rnd() - 0.5) * 3));
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function SunriseScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [day, night, moonMap] = useLoader(getKTX2Loader(gl), [TEX.day, TEX.night, TEX.moon]);
  const { earth, atmosphere, glow } = useMemo(() => {
    for (const t of [day, night, moonMap]) {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      }
    }
    if (!day || !night) throw new Error('SC06: Earth textures missing');
    return {
      earth: createEarthMaterial(day, night, low),
      atmosphere: createAtmosphereMaterial(),
      glow: glowTexture(),
    };
  }, [day, night, moonMap, low]);
  useDisposeOnUnmount(earth, atmosphere, glow);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunSprite = useRef<THREE.Sprite>(null);
  const ship = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id) return;
    const t = frame.t;
    sunDirection(t, dir);
    (earth.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    (atmosphere.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    const l = sunLightRef.current;
    if (l) {
      l.position.set(dir[0], dir[1], dir[2]).multiplyScalar(200);
      l.intensity = sunLight(t);
    }
    const s = sunSprite.current;
    if (s) s.position.set(dir[0], dir[1], dir[2]).multiplyScalar(SUN_DISTANCE);
    if (ship.current) {
      ship.current.rotation.y = shipYaw(t);
      // drift along the bow heading
      ship.current.position.set(0, 0, 0);
      ship.current.translateX(-shipDrift(t));
    }
    ENGINE.current = engineLevel(t);
  });

  return (
    <group>
      <Starfield count={5000} radius={1500} seed={31} />
      <mesh position={[...EARTH.centre]} rotation={[0.19, -2.51, 0]} material={earth}>
        <sphereGeometry args={[EARTH.radius, low ? 64 : 128, low ? 48 : 96]} />
      </mesh>
      <mesh position={[...EARTH.centre]} material={atmosphere}>
        <sphereGeometry args={[EARTH.radius * 1.03, 64, 48]} />
      </mesh>
      <mesh position={[...MOON.position]} rotation={[0, 2.4, 0]}>
        <sphereGeometry args={[MOON.radius, 48, 32]} />
        <meshLambertMaterial map={moonMap ?? null} color="#d8d8d8" />
      </mesh>
      <sprite ref={sunSprite} scale={[300, 300, 1]}>
        <spriteMaterial
          map={glow}
          color={new THREE.Color(2, 1.8, 1.5)}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <directionalLight ref={sunLightRef} color="#fff1dc" />
      <hemisphereLight args={['#4a6fb5', '#05070c', 0.35]} />
      <HelVela ref={ship} engine={ENGINE} />
    </group>
  );
}

export const sc06Sunrise: ChapterImpl = {
  Scene: SunriseScene,
  shot: sunriseShot,
  background: '#010208',
};
