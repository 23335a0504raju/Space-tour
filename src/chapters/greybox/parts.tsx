import { forwardRef, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { DeepSky, GALAXY } from '../space/DeepSky.tsx';

/**
 * Grey-box building blocks (P2). Stand-ins for real assets: correct placement, scale and
 * light only. Every one of them is replaced by a sourced/optimised asset in later phases.
 */

const ZERO: [number, number, number] = [0, 0, 0];

// ── Seeded randomness (no Math.random in story code) ──────────────────────────
export function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ── Starfield ─────────────────────────────────────────────────────────────────
export const starVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vSize;
  void main() {
    vColor = aColor;
    vSize = aSize * uScale;
    gl_PointSize = vSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const starFragment = /* glsl */ `
  uniform float uFade;
  varying vec3 vColor;
  varying float vSize;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    // soft round core with a faint halo
    float core = exp(-r * r * 9.0);
    float halo = exp(-r * 3.5) * 0.25;
    // the brightest stars get thin diffraction spikes (lens look of the references)
    float spikes = 0.0;
    if (vSize > 9.0) {
      float sx = exp(-abs(c.y) * vSize * 1.6) * (1.0 - abs(c.x) * 2.0);
      float sy = exp(-abs(c.x) * vSize * 1.6) * (1.0 - abs(c.y) * 2.0);
      spikes = max(sx, sy) * 0.9;
    }
    float a = core + halo + spikes;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * a * uFade, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Sharp stars over the baked deep sky (DeepSky): magnitudes follow a steep power law (mostly faint,
 * a few bright with spikes), colours run from blue-white to warm, and density rises toward the
 * galactic band. Additive point sprites: one draw call.
 */
const IDENTITY = new THREE.Quaternion();

export function Starfield({
  count = 8000,
  radius = 400,
  seed = 1,
  sky = true,
  follow = false,
  orient,
  fade,
  fadeSky = false,
}: {
  count?: number;
  radius?: number;
  seed?: number;
  /** Draw the deep-sky backdrop behind the stars (off where a chapter has its own sky). */
  sky?: boolean;
  /**
   * Stars at infinity: they move with the camera (no parallax), so chapters that share a seed show
   * the very same stars at a boundary (handoff.ts).
   */
  follow?: boolean;
  /** Orientation of the stars and the deep sky (the shared flight sky, skyFrame.ts). */
  orient?: THREE.Quaternion;
  /** Star brightness 0..1, read every frame (SC05 brings the flight stars in over its own). */
  fade?: { current: number };
  /** Fade the deep-sky backdrop with the stars too (SC10 clears the whole space sky). */
  fadeSky?: boolean;
}) {
  const geometry = useMemo(() => {
    const rand = seeded(seed);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const tints = [
      new THREE.Color('#9fb8ff'),
      new THREE.Color('#d6e0ff'),
      new THREE.Color('#fff4e8'),
      new THREE.Color('#ffd9a0'),
      new THREE.Color('#ffb48a'),
    ];
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i += 1) {
      // rejection-sample toward the galactic band: about 2.5x denser on it
      for (let tries = 0; tries < 6; tries += 1) {
        const u = rand() * 2 - 1;
        const th = rand() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        v.set(r * Math.cos(th), u, r * Math.sin(th));
        const bnd = Math.exp(-(v.dot(GALAXY.normal) ** 2) / 0.03);
        if (rand() < 0.4 + 0.6 * bnd) break;
      }
      positions.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
      const m = Math.pow(rand(), 9); // steep: most faint, a handful very bright
      sizes[i] = 1.4 + m * 14;
      const c = tints[Math.floor(rand() * tints.length)] ?? tints[1]!;
      const k = 0.45 + 0.55 * Math.min(1, m * 3 + rand() * 0.5);
      colors.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [count, radius, seed]);
  const dpr = useThree((s) => s.viewport.dpr);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        uniforms: { uScale: { value: Math.min(dpr, 2) }, uFade: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [dpr],
  );
  useDisposeOnUnmount(geometry, material);
  const holder = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (follow) holder.current?.position.copy(camera.position);
    if (fade) {
      material.uniforms.uFade!.value = fade.current;
      // even at zero brightness the points would still write alpha, which the style pass reads as
      // "not painted" (PAINTED_BLEND) and inks as grey blobs over painted clouds
      if (holder.current) holder.current.visible = fade.current > 0.001;
    }
  });
  return (
    <>
      {sky && (
        <DeepSky
          rotation={((seed % 5) - 2) * 0.14}
          {...(orient ? { quaternion: orient } : {})}
          {...(fade && fadeSky ? { fade } : {})}
        />
      )}
      <group ref={holder} quaternion={orient ?? IDENTITY}>
        <points geometry={geometry} material={material} frustumCulled={false} />
      </group>
    </>
  );
}

// ── Planet (procedural shader) ────────────────────────────────────────────────
export type PlanetMode = 'terrain' | 'rock' | 'bands';
const MODE_ID: Record<PlanetMode, number> = { terrain: 0, rock: 1, bands: 2 };

const planetVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewN;
  void main() {
    vObj = position;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const planetFragment = /* glsl */ `
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  uniform vec3 uSun; uniform vec3 uAtmo; uniform float uAtmoStrength;
  uniform int uMode; uniform float uSeed;
  varying vec3 vObj; varying vec3 vNormalW; varying vec3 vViewN;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)) + uSeed) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 n = normalize(vObj);
    vec3 base;
    if (uMode == 0) {
      float h = fbm(n * 2.6);
      base = mix(uA, mix(uB, uC, smoothstep(0.55, 0.7, h)), smoothstep(0.49, 0.53, h));
    } else if (uMode == 1) {
      float h = fbm(n * 4.0);
      base = mix(uA, uB, h) * (0.8 + 0.4 * fbm(n * 18.0));
    } else {
      float lat = n.y + 0.08 * fbm(n * 3.0);
      float band = 0.5 + 0.5 * sin(lat * 22.0);
      base = mix(mix(uA, uB, band), uC, smoothstep(0.75, 1.0, fbm(n * 6.0)));
    }
    float light = clamp(dot(normalize(vNormalW), normalize(uSun)), 0.0, 1.0);
    float rim = pow(1.0 - abs(vViewN.z), 3.0);
    vec3 col = base * (0.02 + light) + uAtmo * rim * uAtmoStrength * (0.15 + light);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface PlanetProps {
  radius: number;
  mode: PlanetMode;
  colors: [string, string, string];
  atmosphere?: string;
  atmosphereStrength?: number;
  sun?: [number, number, number];
  seed?: number;
  segments?: number;
  children?: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export const Planet = forwardRef<THREE.Mesh, PlanetProps>(function Planet(
  {
    radius,
    mode,
    colors,
    atmosphere = '#000000',
    atmosphereStrength = 0,
    sun = [1, 0.2, 0.5],
    seed = 0,
    segments = 96,
    children,
    position = ZERO,
    rotation = ZERO,
  },
  ref,
) {
  const uniforms = useMemo(
    () => ({
      uA: { value: new THREE.Color(colors[0]) },
      uB: { value: new THREE.Color(colors[1]) },
      uC: { value: new THREE.Color(colors[2]) },
      uSun: { value: new THREE.Vector3(...sun).normalize() },
      uAtmo: { value: new THREE.Color(atmosphere) },
      uAtmoStrength: { value: atmosphereStrength },
      uMode: { value: MODE_ID[mode] },
      uSeed: { value: seed },
    }),
    [colors, atmosphere, atmosphereStrength, mode, seed, sun],
  );
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <sphereGeometry args={[radius, segments, Math.round(segments / 2)]} />
      <shaderMaterial
        vertexShader={planetVertex}
        fragmentShader={planetFragment}
        uniforms={uniforms}
      />
      {children}
    </mesh>
  );
});

// ── Spacecraft stand-in ───────────────────────────────────────────────────────
export const Ship = forwardRef<
  THREE.Group,
  { engine?: number; position?: [number, number, number]; rotation?: [number, number, number] }
>(function Ship({ engine = 0, position = ZERO, rotation = ZERO }, ref) {
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 2.6, 24]} />
        <meshStandardMaterial color="#c9ccd3" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.55, 0.9, 24]} />
        <meshStandardMaterial color="#d8dbe2" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.9, 0.5]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.6, 0.25, 0.1]} />
        <meshStandardMaterial color="#14161c" metalness={0.2} roughness={0.1} />
      </mesh>
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 0.4, 20]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, -1.7 - engine * 1.2, 0]}
        rotation={[Math.PI, 0, 0]}
        visible={engine > 0.01}
      >
        <coneGeometry args={[0.32, Math.max(0.01, engine * 2.4), 16, 1, true]} />
        <meshBasicMaterial color="#ffd9a0" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
});

// ── Astronaut stand-in (faceless, gold visor) ─────────────────────────────────
export const Astronaut = forwardRef<
  THREE.Group,
  { position?: [number, number, number]; rotation?: [number, number, number]; seated?: boolean }
>(function Astronaut({ position = ZERO, rotation = ZERO, seated = false }, ref) {
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh position={[0, seated ? 0.75 : 0.95, 0]}>
        <capsuleGeometry args={[0.24, seated ? 0.45 : 0.85, 8, 16]} />
        <meshStandardMaterial color="#e8e6e0" roughness={0.8} />
      </mesh>
      <mesh position={[0, seated ? 1.35 : 1.62, 0]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color="#efede8" roughness={0.6} />
      </mesh>
      <mesh position={[0, seated ? 1.36 : 1.63, 0.1]} scale={[1, 0.8, 0.8]}>
        <sphereGeometry args={[0.15, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d6a756" metalness={1} roughness={0.15} />
      </mesh>
    </group>
  );
});

// ── Developer room ────────────────────────────────────────────────────────────
export function Room({ children }: { children?: ReactNode }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#1c1e24" roughness={0.9} />
      </mesh>
      {/* back wall with a window opening (two panels + sill/lintel) */}
      <mesh position={[-2.6, 1.5, -3]}>
        <boxGeometry args={[2.8, 3, 0.1]} />
        <meshStandardMaterial color="#2a2d35" />
      </mesh>
      <mesh position={[2.6, 1.5, -3]}>
        <boxGeometry args={[2.8, 3, 0.1]} />
        <meshStandardMaterial color="#2a2d35" />
      </mesh>
      <mesh position={[0, 0.35, -3]}>
        <boxGeometry args={[2.4, 0.7, 0.1]} />
        <meshStandardMaterial color="#2a2d35" />
      </mesh>
      <mesh position={[0, 2.8, -3]}>
        <boxGeometry args={[2.4, 0.4, 0.1]} />
        <meshStandardMaterial color="#2a2d35" />
      </mesh>
      {/* side wall with the door */}
      <mesh position={[4, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#24272e" />
      </mesh>
      <mesh position={[3.94, 1.1, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1, 2.2]} />
        <meshStandardMaterial color="#3b3f49" emissive="#ffffff" emissiveIntensity={0.05} />
      </mesh>
      {/* desk + monitors */}
      <mesh position={[0, 0.75, -1.6]}>
        <boxGeometry args={[2.2, 0.08, 0.9]} />
        <meshStandardMaterial color="#3a3530" roughness={0.6} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.15, -1.95]} rotation={[0, -x * 0.3, 0]}>
          <boxGeometry args={[0.95, 0.55, 0.04]} />
          <meshStandardMaterial color="#0c0f16" emissive="#4f7bd8" emissiveIntensity={0.9} />
        </mesh>
      ))}
      <mesh position={[0.95, 0.85, -1.4]}>
        <sphereGeometry args={[0.16, 20, 12]} />
        <meshStandardMaterial color="#efede8" roughness={0.5} />
      </mesh>
      <pointLight position={[0, 1.4, -1.3]} color="#7aa2ff" intensity={2.5} distance={4} />
      <pointLight position={[-1.4, 2.2, -0.8]} color="#ffbf73" intensity={3} distance={6} />
      {children}
    </group>
  );
}

// ── Orbital station stand-in ──────────────────────────────────────────────────
export function Station({
  variant,
  position,
}: {
  variant: 'ring' | 'pipeline' | 'hub';
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);
  return (
    <group ref={ref} position={position}>
      {variant === 'ring' && (
        <>
          <mesh>
            <torusGeometry args={[1, 0.12, 12, 48]} />
            <meshStandardMaterial color="#c9ccd3" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 1.4, 16]} />
            <meshStandardMaterial color="#9aa0aa" metalness={0.5} />
          </mesh>
        </>
      )}
      {variant === 'pipeline' &&
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[(i - 2) * 0.7, 0, 0]}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial
              color={i === 4 ? '#d6a756' : '#c9ccd3'}
              metalness={0.5}
              roughness={0.4}
            />
          </mesh>
        ))}
      {variant === 'hub' && (
        <>
          <mesh>
            <sphereGeometry args={[0.45, 24, 16]} />
            <meshStandardMaterial color="#c9ccd3" metalness={0.5} roughness={0.4} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.9, 0, 0]}>
              <boxGeometry args={[0.9, 0.12, 0.12]} />
              <meshStandardMaterial color="#9aa0aa" />
            </mesh>
          ))}
        </>
      )}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.8, 0.02, 0.6]} />
        <meshStandardMaterial color="#1f3a66" metalness={0.3} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Asteroids (instanced) ─────────────────────────────────────────────────────
export function Asteroids({
  count,
  spread,
  seed = 3,
}: {
  count: number;
  spread: [number, number, number];
  seed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = seeded(seed);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i += 1) {
      p.set((rand() - 0.5) * spread[0], (rand() - 0.5) * spread[1], (rand() - 0.5) * spread[2]);
      q.setFromEuler(e.set(rand() * 6, rand() * 6, rand() * 6));
      const k = 0.1 + rand() * rand() * 1.2;
      s.set(k, k * (0.6 + rand() * 0.5), k);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, spread, seed]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#6e6a63" roughness={0.95} flatShading />
    </instancedMesh>
  );
}

// ── Anime-style stand-ins: toon shading + inverted-hull outline ───────────────
const toonRamp = (() => {
  const data = new Uint8Array([60, 140, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

export function ToonShape({
  geometry,
  color,
  position,
  scale = 1,
  outline = 0.04,
}: {
  geometry: 'sphere' | 'box' | 'cone' | 'torus';
  color: string;
  position: [number, number, number];
  scale?: number;
  outline?: number;
}) {
  const geo = (() => {
    switch (geometry) {
      case 'sphere':
        return <sphereGeometry args={[1, 32, 20]} />;
      case 'box':
        return <boxGeometry args={[1.4, 1.4, 1.4]} />;
      case 'cone':
        return <coneGeometry args={[1, 2.2, 6]} />;
      case 'torus':
        return <torusGeometry args={[1, 0.3, 12, 40]} />;
    }
  })();
  return (
    <group position={position} scale={scale}>
      <mesh>
        {geo}
        <meshToonMaterial color={color} gradientMap={toonRamp} />
      </mesh>
      <mesh scale={1 + outline}>
        {geo}
        <meshBasicMaterial color="#121018" side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
