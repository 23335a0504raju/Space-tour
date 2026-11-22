import { useLayoutEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { Planet } from '../greybox/parts.tsx';
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
 * SC10's look back: the Sun and all eight planets (solarSystem.ts). Textured planets use NASA maps
 * already in the project (A023–A026); Venus, Uranus and Neptune are procedural (no new assets).
 * Every planet is lit from the visible Sun, with a hard terminator and a thin atmosphere rim.
 */

const TEX = {
  earth: '/assets/textures/earth_day_2k.ktx2',
  mars: '/assets/textures/mars_2k.ktx2',
  jupiter: '/assets/textures/jupiter_2k.ktx2',
  moon: '/assets/textures/moon_1k.ktx2',
} as const;

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
}: {
  map: THREE.Texture;
  position: THREE.Vector3;
  radius: number;
  tint?: string;
  atmosphere?: string;
  atmosphereStrength?: number;
  spin?: number;
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
    <mesh position={position} rotation={[0.2, spin, 0.05]} material={material}>
      <sphereGeometry args={[radius, 64, 32]} />
    </mesh>
  );
}

/** A soft radial glow texture (made once). */
function glowTexture(size: number, stops: readonly [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
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

const PROCEDURAL: Partial<
  Record<PlanetKind, { colors: [string, string, string]; atmosphere: string; strength: number }>
> = {
  venus: { colors: ['#e9d6a8', '#d8bf8c', '#f4e6c4'], atmosphere: '#ffe6b0', strength: 0.9 },
  uranus: { colors: ['#a6d8dc', '#bfe6e8', '#94ccd2'], atmosphere: '#c4ecff', strength: 0.8 },
  neptune: { colors: ['#2f5fb3', '#3f78cc', '#264d96'], atmosphere: '#7aa8ff', strength: 0.8 },
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
  const [earth, mars, jupiter, moon] = useLoader(getKTX2Loader(gl), [
    TEX.earth,
    TEX.mars,
    TEX.jupiter,
    TEX.moon,
  ]);
  useLayoutEffect(() => {
    for (const t of [earth, mars, jupiter, moon]) if (t) t.colorSpace = THREE.SRGBColorSpace;
  }, [earth, mars, jupiter, moon]);
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
        const proc = PROCEDURAL[p.kind];
        if (proc) {
          const sun = sunFrom(p.position).toArray() as [number, number, number];
          return (
            <Planet
              key={p.kind}
              position={p.position.toArray() as [number, number, number]}
              radius={p.radius}
              mode="bands"
              colors={proc.colors}
              atmosphere={proc.atmosphere}
              atmosphereStrength={proc.strength}
              sun={sun}
              segments={64}
            />
          );
        }
        if (p.kind === 'saturn') {
          return (
            <group key={p.kind} position={p.position} scale={p.radius / SATURN.radius}>
              <SaturnSystem sun={saturnSun} />
            </group>
          );
        }
        const map =
          p.kind === 'earth'
            ? earth
            : p.kind === 'mars'
              ? mars
              : p.kind === 'jupiter'
                ? jupiter
                : moon;
        if (!map) return null;
        return (
          <TexturedPlanet
            key={p.kind}
            map={map}
            position={p.position}
            radius={p.radius}
            tint={p.kind === 'mercury' ? '#cbbba6' : '#ffffff'}
            atmosphere={p.kind === 'earth' ? '#7fb2ff' : p.kind === 'mars' ? '#e6a07a' : '#000000'}
            atmosphereStrength={p.kind === 'earth' ? 1.1 : p.kind === 'mars' ? 0.4 : 0}
          />
        );
      })}
    </group>
  );
}
