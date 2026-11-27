import { useMemo, useRef } from 'react';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createEarthMaterial, createLimbAtmosphereMaterial } from '../../shaders/earth.ts';
import type { ChapterImpl, ChapterSceneProps } from '../contract.ts';
import { Starfield, seeded } from '../greybox/parts.tsx';
import { HelVela } from '../ship/HelVela.tsx';
import { SunStar } from '../space/SunStar.tsx';
import { LIGHT_07, TRAVEL_STARS } from '../handoff.ts';
import { TRAVEL_SKY } from '../space/skyFrame.ts';

const DIR_07 = new THREE.Vector3(...LIGHT_07.direction).normalize();
const KEY_06 = new THREE.Color('#fff1dc');
const KEY_07 = new THREE.Color(LIGHT_07.color);
const SKY_06 = new THREE.Color('#1c2740');
const SKY_07 = new THREE.Color(LIGHT_07.sky);
const GROUND_06 = new THREE.Color('#23396b');
const GROUND_07 = new THREE.Color(LIGHT_07.ground);
import {
  EARTH,
  EARTH_QUAT,
  MOON,
  SUN_DISTANCE,
  engineLevel,
  shipZ,
  BURN,
  SHIP_YAW,
  span,
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

/**
 * Canvas texture from an alpha function of the centred coordinates (x, y in -1..1), computed per pixel
 * in float and dithered by half a step: smooth falloffs with no gradient banding and no visible grain.
 * White RGB; the sprite colour tints it (warm tints on faint alpha turned brown under AgX).
 */
function falloffTexture(size: number, alpha: (x: number, y: number) => number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = textureContext(c);
  if (g) {
    const img = g.createImageData(size, size);
    const rnd = seeded(7);
    for (let j = 0; j < size; j += 1)
      for (let i = 0; i < size; i += 1) {
        const x = ((i + 0.5) / size) * 2 - 1;
        const y = ((j + 0.5) / size) * 2 - 1;
        const k = (j * size + i) * 4;
        img.data[k] = 255;
        img.data[k + 1] = 255;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.min(255, Math.max(0, Math.round(alpha(x, y) * 255 + rnd() - 0.5)));
      }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The lens's faint anamorphic streak across the Sun, in its own warm light. */
function streakTexture() {
  return falloffTexture(512, (x, y) => {
    return Math.exp(-Math.abs(x) * 5) * Math.exp(-((y / 0.018) ** 2)) * (1 - x * x);
  });
}

/** The Sun's radius at SUN_DISTANCE (about 4 degrees across, as large as the look back's). */
const SUN_RADIUS = 52;

function SunriseScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [day, night, moonMap] = useLoader(getKTX2Loader(gl), [TEX.day, TEX.night, TEX.moon]);
  const { earth, atmosphere, streak, earthRot, moon } = useMemo(() => {
    for (const t of [day, night, moonMap]) {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
      }
    }
    if (!day || !night) throw new Error('SC06: Earth textures missing');
    return {
      earth: createEarthMaterial(day, night, low),
      atmosphere: createLimbAtmosphereMaterial(EARTH.radius, new THREE.Vector3(...EARTH.centre)),
      streak: streakTexture(),
      earthRot: new THREE.Euler().setFromQuaternion(EARTH_QUAT),
      // lit by the Sun alone (a crescent here) plus faint grey earthshine; the scene's cool earthshine
      // light would tint it blue
      moon: new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: moonMap ?? null },
          uSun: { value: new THREE.Vector3(0, 0, -1) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec2 vUv;
          void main(){
            vN = normalize(mat3(modelMatrix) * normal);
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform vec3 uSun; varying vec3 vN; varying vec2 vUv;
          void main(){
            vec3 albedo = texture2D(uMap, vec2(vUv.x, 1.0 - vUv.y)).rgb;
            float d = max(dot(normalize(vN), uSun), 0.0);
            gl_FragColor = vec4(albedo * (d * 1.6 + 0.035), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    };
  }, [day, night, moonMap, low]);
  useDisposeOnUnmount(earth, atmosphere, moon, streak);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunGroup = useRef<THREE.Group>(null);
  const ship = useRef<THREE.Group>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const earthshine = useRef<THREE.DirectionalLight>(null);
  useFrame(({ camera }) => {
    if (frame.id !== id) return;
    const t = frame.t;
    sunDirection(t, dir);
    (earth.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    (atmosphere.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    (moon.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    const l = sunLightRef.current;
    // the departure: the ship's light turns into SC07's (the planet and Moon light themselves)
    const w = span(t, BURN.from, 1);
    if (l) {
      l.position.set(dir[0], dir[1], dir[2]).lerp(DIR_07, w).normalize().multiplyScalar(200);
      l.intensity = sunLight(t) + (LIGHT_07.intensity - sunLight(t)) * w;
      l.color.copy(KEY_06).lerp(KEY_07, w);
    }
    if (fill.current) {
      fill.current.color.copy(SKY_06).lerp(SKY_07, w);
      fill.current.groundColor.copy(GROUND_06).lerp(GROUND_07, w);
      fill.current.intensity = 0.5 + (LIGHT_07.ambient - 0.5) * w;
    }
    if (earthshine.current) earthshine.current.intensity = 0.9 * (1 - w);
    const s = sunGroup.current;
    // anchored to the camera: the Sun is at infinity (a fixed point 1.5 km out dropped behind the
    // planet through parallax); the Earth's limb, ~450 m away, still hides it by depth
    if (s) s.position.set(dir[0], dir[1], dir[2]).multiplyScalar(SUN_DISTANCE).add(camera.position);
    if (ship.current) {
      ship.current.rotation.y = SHIP_YAW;
      ship.current.position.set(0, 0, shipZ(t));
    }
    ENGINE.current = engineLevel(t);
  });

  return (
    <group>
      <Starfield {...TRAVEL_STARS} follow orient={TRAVEL_SKY} />
      <mesh position={[...EARTH.centre]} rotation={earthRot} material={earth}>
        <sphereGeometry args={[EARTH.radius, low ? 96 : 192, low ? 64 : 128]} />
      </mesh>
      <mesh position={[...EARTH.centre]} material={atmosphere}>
        <sphereGeometry args={[EARTH.radius * 1.04, 128, 96]} />
      </mesh>
      <mesh position={[...MOON.position]} rotation={[0, 2.4, 0]}>
        <sphereGeometry args={[MOON.radius, 48, 32]} />
        <primitive object={moon} attach="material" />
      </mesh>
      {/* the Earth hides the Sun until it clears the limb (all of it is depth-tested) */}
      <group ref={sunGroup}>
        <SunStar radius={SUN_RADIUS} />
        <sprite scale={[1100, 1100, 1]} renderOrder={6}>
          <spriteMaterial
            map={streak}
            color={new THREE.Color(0.5, 0.25, 0.1)}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>
      <directionalLight ref={sunLightRef} color="#fff1dc" />
      {/* earthshine from below, cool sky from above: low, so the sunrise is the event */}
      <hemisphereLight ref={fill} args={['#1c2740', '#23396b', 0.5]} />
      {/* earthshine: the lit planet below is a broad cool source; gives the hull form and speculars
          while the Sun backlights it */}
      <directionalLight ref={earthshine} position={[0, -100, 40]} intensity={0.9} color="#5b7fc4" />
      <HelVela ref={ship} engine={ENGINE} />
    </group>
  );
}

export const sc06Sunrise: ChapterImpl = {
  Scene: SunriseScene,
  shot: sunriseShot,
  background: '#010208',
};
