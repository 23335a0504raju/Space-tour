import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { SunStar } from '../space/SunStar.tsx';
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
/** Atmosphere rims for the textured planets (colour, strength). */
const RIMS: Partial<Record<PlanetKind, readonly [string, number]>> = {
  earth: ['#7fb2ff', 1.1],
  mars: ['#e6a07a', 0.4],
  venus: ['#ffe6b0', 0.9],
  uranus: ['#c4ecff', 0.8],
  neptune: ['#7aa8ff', 0.8],
};

/** Where the Sun's disc is on screen (drawing-buffer pixels), written each frame by OrbitFade. */
const sunOnScreen = {
  px: { value: new THREE.Vector2(-1e4, -1e4) },
  r: { value: 0 },
};
const sunNdc = new THREE.Vector3();

/** Projects the Sun's centre and radius to the screen for the orbit lines' fade. */
function OrbitFade() {
  useFrame(({ camera, gl }) => {
    const size = gl.getDrawingBufferSize(sunScratch);
    sunNdc.copy(SUN_POSITION).project(camera);
    sunOnScreen.px.value.set(((sunNdc.x + 1) / 2) * size.x, ((sunNdc.y + 1) / 2) * size.y);
    const dist = camera.position.distanceTo(SUN_POSITION);
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 45);
    sunOnScreen.r.value =
      sunNdc.z < 1 ? (SUN_RADIUS / (dist * Math.tan(fov / 2))) * (size.y / 2) : 0;
  });
  return null;
}
const sunScratch = new THREE.Vector2();

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
    // edge-on, every orbit passes in front of the Sun: fade the lines where they cross its disc
    material.onBeforeCompile = (shader) => {
      shader.uniforms['uSunPx'] = sunOnScreen.px;
      shader.uniforms['uSunR'] = sunOnScreen.r;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec2 uSunPx; uniform float uSunR;\nvoid main() {')
        .replace(
          '#include <opaque_fragment>',
          'diffuseColor.a *= smoothstep(uSunR * 1.15, uSunR * 2.2, distance(gl_FragCoord.xy, uSunPx));\n#include <opaque_fragment>',
        );
    };
    material.customProgramCacheKey = () => 'orbits-sun-fade';
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
      <group position={SUN_POSITION}>
        <SunStar radius={SUN_RADIUS} />
      </group>
      <Orbits />
      <OrbitFade />
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
