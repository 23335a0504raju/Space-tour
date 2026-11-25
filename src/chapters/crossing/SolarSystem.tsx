import { useLayoutEffect, useMemo } from 'react';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { SaturnSystem } from '../saturn/Saturn.tsx';
import { SATURN } from '../saturn/saturn.ts';
import {
  PLANETS,
  SUN_POSITION,
  SUN_RADIUS,
  orbitPoints,
  planetPosition,
  sunFrom,
} from './solarSystem.ts';
import type { PlanetKind } from './solarSystem.ts';

/**
 * SC10's look back: the Sun and all eight planets (solarSystem.ts). Earth, Mars, Jupiter and the
 * Moon-mapped Mercury use NASA maps (A021–A026); Venus, Uranus and Neptune use Solar System Scope
 * maps (A051–A053, CC BY 4.0, credited in the Mission Brief). Every planet is lit from the visible
 * Sun, with a hard terminator and a thin atmosphere rim; Uranus lies on its side with its faint rings.
 */

const TEX = {
  earth: '/assets/textures/earth_day_2k.ktx2',
  mars: '/assets/textures/mars_2k.ktx2',
  jupiter: '/assets/textures/jupiter_2k.ktx2',
  moon: '/assets/textures/moon_1k.ktx2',
  venus: '/assets/textures/venus_1k.ktx2',
  uranus: '/assets/textures/uranus_1k.ktx2',
  neptune: '/assets/textures/neptune_1k.ktx2',
} as const;

/** Uranus's axis lies almost in its orbit plane (about 98°): its rings stand nearly upright. */
const URANUS_TILT: [number, number, number] = [0.25, 0.4, 1.71];

const litVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewN;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const litFragment = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uTint; uniform vec3 uSun; uniform vec3 uAtmo; uniform float uAtmoStrength;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewN;
  void main() {
    vec3 base = texture2D(uMap, vUv).rgb * uTint;
    float d = dot(normalize(vNormalW), uSun);
    // a hard terminator with a narrow twilight band
    float light = smoothstep(-0.04, 0.12, d) * (0.25 + 0.75 * max(d, 0.0));
    float rim = pow(1.0 - abs(vViewN.z), 3.0);
    vec3 col = base * (0.012 + 1.35 * light) + uAtmo * rim * uAtmoStrength * smoothstep(-0.25, 0.3, d);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function TexturedPlanet({
  map,
  position,
  radius,
  tint = '#ffffff',
  atmosphere = '#000000',
  atmosphereStrength = 0,
  spin = 0,
  rotation,
}: {
  map: THREE.Texture;
  position: THREE.Vector3;
  radius: number;
  tint?: string;
  atmosphere?: string;
  atmosphereStrength?: number;
  spin?: number;
  /** overrides the default slight tilt (Uranus lies on its side) */
  rotation?: [number, number, number] | undefined;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: litVertex,
        fragmentShader: litFragment,
        uniforms: {
          uMap: { value: map },
          uTint: { value: new THREE.Color(tint) },
          uSun: { value: sunFrom(position) },
          uAtmo: { value: new THREE.Color(atmosphere) },
          uAtmoStrength: { value: atmosphereStrength },
        },
      }),
    [map, tint, position, atmosphere, atmosphereStrength],
  );
  useDisposeOnUnmount(material);
  return (
    <mesh position={position} rotation={rotation ?? [0.2, spin, 0.05]} material={material}>
      <sphereGeometry args={[radius, 64, 32]} />
    </mesh>
  );
}

/**
 * Uranus's rings: narrow, dark and faint (nothing like Saturn's), the epsilon ring the brightest.
 * Thin bands on one flat annulus in the planet's tilted equator (radii in planet radii).
 */
function UranusRings({
  position,
  radius,
  rotation,
}: {
  position: THREE.Vector3;
  radius: number;
  rotation: [number, number, number];
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uR: { value: radius } },
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() {
            vP = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uR; varying vec2 vP;
          void main() {
            float r = length(vP) / uR;
            float a = 0.0;
            a += 0.35 * (1.0 - smoothstep(0.0, 0.006, abs(r - 1.64)));
            a += 0.30 * (1.0 - smoothstep(0.0, 0.006, abs(r - 1.70)));
            a += 0.40 * (1.0 - smoothstep(0.0, 0.008, abs(r - 1.79)));
            a += 0.45 * (1.0 - smoothstep(0.0, 0.007, abs(r - 1.86)));
            a += 0.50 * (1.0 - smoothstep(0.0, 0.008, abs(r - 1.95)));
            a += 1.00 * (1.0 - smoothstep(0.0, 0.022, abs(r - 2.00)));
            gl_FragColor = vec4(vec3(0.62, 0.66, 0.7) * a * 0.55, a * 0.5);
            #include <colorspace_fragment>
          }`,
      }),
    [radius],
  );
  useDisposeOnUnmount(material);
  // the annulus lies in the planet's equator (the sphere's local x/z plane)
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <ringGeometry args={[radius * 1.55, radius * 2.1, 128, 1]} />
      </mesh>
    </group>
  );
}

/** A soft radial glow texture (made once). */
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

/** The Sun: a white-hot disc, a warm corona and a faint horizontal flare (bloom does the rest). */
function Sun() {
  const { corona, flare } = useMemo(
    () => ({
      corona: glowTexture(256, [
        [0, 'rgba(255,252,244,1)'],
        [0.08, 'rgba(255,244,222,0.7)'],
        [0.22, 'rgba(255,214,160,0.16)'],
        [0.5, 'rgba(255,190,120,0.04)'],
        [1, 'rgba(255,170,90,0)'],
      ]),
      flare: glowTexture(256, [
        [0, 'rgba(255,240,215,0.9)'],
        [0.5, 'rgba(255,220,170,0.12)'],
        [1, 'rgba(255,200,140,0)'],
      ]),
    }),
    [],
  );
  useDisposeOnUnmount(corona, flare);
  return (
    <group position={SUN_POSITION}>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 32, 16]} />
        <meshBasicMaterial color={new THREE.Color(9, 7.6, 6)} toneMapped={false} />
      </mesh>
      <sprite scale={[SUN_RADIUS * 11, SUN_RADIUS * 11, 1]}>
        <spriteMaterial
          map={corona}
          color={new THREE.Color(1.7, 1.55, 1.4)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={[SUN_RADIUS * 40, SUN_RADIUS * 1.6, 1]}>
        <spriteMaterial
          map={flare}
          color={new THREE.Color(1.6, 1.4, 1.2)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

/** Atmosphere rims for the textured planets (colour, strength). */
const RIMS: Partial<Record<PlanetKind, readonly [string, number]>> = {
  earth: ['#7fb2ff', 1.1],
  mars: ['#e6a07a', 0.4],
  venus: ['#ffe6b0', 0.9],
  uranus: ['#c4ecff', 0.8],
  neptune: ['#7aa8ff', 0.8],
};

/** Thin orbit lines round the Sun, one per planet (an orrery's guides, faint and additive). */
function Orbits() {
  const { lines, material } = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#9fb6dc'),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lines = PLANETS.map((p) => {
      const g = new THREE.BufferGeometry().setFromPoints(orbitPoints(p));
      const line = new THREE.Line(g, material);
      line.frustumCulled = false;
      return line;
    });
    return { lines, material };
  }, []);
  useDisposeOnUnmount(material, ...lines.map((l) => l.geometry));
  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

export function SolarSystem() {
  const gl = useThree((s) => s.gl);
  const maps = useLoader(getKTX2Loader(gl), [
    TEX.earth,
    TEX.mars,
    TEX.jupiter,
    TEX.moon,
    TEX.venus,
    TEX.uranus,
    TEX.neptune,
  ]);
  useLayoutEffect(() => {
    for (const t of maps) if (t) t.colorSpace = THREE.SRGBColorSpace;
  }, [maps]);
  const [earth, mars, jupiter, moon, venus, uranus, neptune] = maps;
  const mapFor: Partial<Record<PlanetKind, THREE.Texture | undefined>> = {
    earth,
    mars,
    jupiter,
    mercury: moon,
    venus,
    uranus,
    neptune,
  };
  const placed = useMemo(() => PLANETS.map((p) => ({ ...p, position: planetPosition(p) })), []);
  const saturnSun = useMemo(() => {
    const s = placed.find((p) => p.kind === 'saturn');
    return s ? sunFrom(s.position) : new THREE.Vector3(0, 0, 1);
  }, [placed]);
  return (
    <group>
      <Sun />
      <Orbits />
      {placed.map((p) => {
        if (p.kind === 'saturn') {
          return (
            <group key={p.kind} position={p.position} scale={p.radius / SATURN.radius}>
              <SaturnSystem sun={saturnSun} />
            </group>
          );
        }
        const map = mapFor[p.kind];
        if (!map) return null;
        const [atmosphere, atmosphereStrength] = RIMS[p.kind] ?? ['#000000', 0];
        const tilt = p.kind === 'uranus' ? URANUS_TILT : undefined;
        return (
          <group key={p.kind}>
            <TexturedPlanet
              map={map}
              position={p.position}
              radius={p.radius}
              tint={p.kind === 'mercury' ? '#cbbba6' : '#ffffff'}
              atmosphere={atmosphere}
              atmosphereStrength={atmosphereStrength}
              rotation={tilt}
            />
            {tilt && <UranusRings position={p.position} radius={p.radius} rotation={tilt} />}
          </group>
        );
      })}
    </group>
  );
}
