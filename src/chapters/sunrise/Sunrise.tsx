import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import { createEarthMaterial, createLimbAtmosphereMaterial } from '../../shaders/earth.ts';
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

/**
 * Canvas texture from an alpha function of the centred coordinates (x, y in -1..1), computed per pixel
 * in float and dithered by half a step: smooth falloffs with no gradient banding and no visible grain.
 * White RGB; the sprite colour tints it (warm tints on faint alpha turned brown under AgX).
 */
function falloffTexture(size: number, alpha: (x: number, y: number) => number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
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

/** The Sun as a lens sees it: a white-hot disc, a tight bloom halo and a faint anamorphic streak. */
function sunTextures() {
  const edge = (r: number) => Math.max(0, 1 - r) ** 2; // forces every profile to 0 at the sprite edge
  return {
    core: falloffTexture(128, (x, y) => {
      const r = Math.hypot(x, y);
      return Math.min(1, Math.max(0, (0.36 - r) / 0.06) + Math.exp(-r * 9) * 0.6) * edge(r);
    }),
    halo: falloffTexture(512, (x, y) => {
      const r = Math.hypot(x, y);
      return (Math.exp(-r * 11) * 0.8 + Math.exp(-r * 4) * 0.12) * edge(r);
    }),
    streak: falloffTexture(512, (x, y) => {
      return Math.exp(-Math.abs(x) * 5) * Math.exp(-((y / 0.018) ** 2)) * (1 - x * x);
    }),
  };
}

/**
 * Earth's orientation: India (22°N 79°E) under the ship with east pointing ahead (-z), so the ship
 * flies into the sunrise. SphereGeometry: lon φ, colatitude θ → (-cosφ sinθ, cosθ, sinφ sinθ).
 */
function earthQuaternion(): THREE.Quaternion {
  const lat = THREE.MathUtils.degToRad(22);
  const lon = THREE.MathUtils.degToRad(79);
  const th = Math.PI / 2 - lat;
  const ph = lon + Math.PI;
  const up = new THREE.Vector3(
    -Math.cos(ph) * Math.sin(th),
    Math.cos(th),
    Math.sin(ph) * Math.sin(th),
  );
  const east = new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)).normalize();
  const north = new THREE.Vector3().crossVectors(up, east);
  const local = new THREE.Matrix4().makeBasis(east, north, up);
  // the point under the opening camera, a little ahead of it
  const U = new THREE.Vector3(0, 40, -60).sub(new THREE.Vector3(...EARTH.centre)).normalize();
  const E = new THREE.Vector3(0, 0, -1).projectOnPlane(U).normalize();
  const N = new THREE.Vector3().crossVectors(U, E);
  const world = new THREE.Matrix4().makeBasis(E, N, U);
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose()));
}

function SunriseScene({ id, frame }: ChapterSceneProps) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const [day, night, moonMap] = useLoader(getKTX2Loader(gl), [TEX.day, TEX.night, TEX.moon]);
  const { earth, atmosphere, sun, earthRot, moon } = useMemo(() => {
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
      sun: sunTextures(),
      earthRot: new THREE.Euler().setFromQuaternion(earthQuaternion()),
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
  useDisposeOnUnmount(earth, atmosphere, moon, sun.core, sun.halo, sun.streak);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunGroup = useRef<THREE.Group>(null);
  const ship = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (frame.id !== id) return;
    const t = frame.t;
    sunDirection(t, dir);
    (earth.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    (atmosphere.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    (moon.uniforms['uSun']?.value as THREE.Vector3).set(dir[0], dir[1], dir[2]);
    const l = sunLightRef.current;
    if (l) {
      l.position.set(dir[0], dir[1], dir[2]).multiplyScalar(200);
      l.intensity = sunLight(t);
    }
    const s = sunGroup.current;
    // anchored to the camera: the Sun is at infinity (a fixed point 1.5 km out dropped behind the
    // planet through parallax); the Earth's limb, ~450 m away, still hides it by depth
    if (s) s.position.set(dir[0], dir[1], dir[2]).multiplyScalar(SUN_DISTANCE).add(camera.position);
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
      {/* the Earth hides the Sun until it clears the limb (depth-tested sprites) */}
      <group ref={sunGroup}>
        <sprite scale={[520, 520, 1]} renderOrder={5}>
          <spriteMaterial
            map={sun.halo}
            color={new THREE.Color(1.5, 1.38, 1.2)}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[1100, 1100, 1]} renderOrder={6}>
          <spriteMaterial
            map={sun.streak}
            color={new THREE.Color(0.55, 0.58, 0.66)}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[60, 60, 1]} renderOrder={7}>
          <spriteMaterial
            map={sun.core}
            color={new THREE.Color(4, 3.8, 3.4)}
            toneMapped={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      </group>
      <directionalLight ref={sunLightRef} color="#fff1dc" />
      {/* earthshine from below, cool sky from above: low, so the sunrise is the event */}
      <hemisphereLight args={['#1c2740', '#23396b', 0.5]} />
      {/* earthshine: the lit planet below is a broad cool source; gives the hull form and speculars
          while the Sun backlights it */}
      <directionalLight position={[0, -100, 40]} intensity={0.9} color="#5b7fc4" />
      <HelVela ref={ship} engine={ENGINE} />
    </group>
  );
}

export const sc06Sunrise: ChapterImpl = {
  Scene: SunriseScene,
  shot: sunriseShot,
  background: '#010208',
};
