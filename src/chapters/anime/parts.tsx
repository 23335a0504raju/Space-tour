import { useEffect, useMemo, useRef } from 'react';
import type { Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { seeded } from '../greybox/parts.tsx';

/** Flat-shaded stand-ins for the anime universe. The style pass turns them into cel colour. */
const flat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => ({
  color,
  roughness: 1,
  metalness: 0,
  flatShading: true,
  ...extra,
});

const glow = (color: string, k = 2) => new THREE.Color(color).multiplyScalar(k);

/** Gradient sky dome (horizon → zenith). Follow the ship by wrapping it in a moving group. */
export function SkyDome({
  colors,
  live,
  painted = false,
}: {
  colors: readonly [string, string, string, string];
  /** a smooth painted gradient (no posterised bands, no ink): see PAINTED_BLEND */
  painted?: boolean;
  /** four colours written every frame (a blend between worlds); overrides `colors` */
  live?: { readonly current: readonly THREE.Color[] };
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uC: { value: colors.map((c) => new THREE.Color(c)) } },
        vertexShader: /* glsl */ `
          varying vec3 vD;
          void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uC[4]; varying vec3 vD;
          void main(){
            float h = clamp(vD.y * 1.4 + 0.15, 0.0, 1.0);
            vec3 c = h < 0.33 ? mix(uC[0], uC[1], h / 0.33)
                   : h < 0.66 ? mix(uC[1], uC[2], (h - 0.33) / 0.33)
                   : mix(uC[2], uC[3], (h - 0.66) / 0.34);
            gl_FragColor = vec4(c, 1.0);
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        ...(painted ? PAINTED_BLEND : {}),
      }),
    [colors, painted],
  );
  useDisposeOnUnmount(mat);
  useFrame(() => {
    if (!live) return;
    const u = mat.uniforms['uC']!.value as THREE.Color[];
    for (let i = 0; i < 4; i += 1) u[i]!.copy(live.current[i]!);
  });
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1200, 32, 20]} />
    </mesh>
  );
}

/** A floating island: grassy flat top, inverted rock cone, optional tree. */
export function Island({
  position,
  radius,
  grass = '#8fd18a',
  rock = '#7a6f8c',
  tree = true,
}: {
  position: readonly [number, number, number];
  radius: number;
  grass?: string;
  rock?: string;
  tree?: boolean;
}) {
  return (
    <group position={[...position]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius * 0.92, radius * 0.18, 9]} />
        <meshStandardMaterial {...flat(grass)} />
      </mesh>
      <mesh position={[0, -radius * 0.62, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.92, radius * 1.1, 9]} />
        <meshStandardMaterial {...flat(rock)} />
      </mesh>
      {tree && (
        <group position={[radius * 0.3, radius * 0.09, 0]}>
          <mesh position={[0, radius * 0.15, 0]}>
            <cylinderGeometry args={[radius * 0.04, radius * 0.05, radius * 0.3, 6]} />
            <meshStandardMaterial {...flat('#6b4a3a')} />
          </mesh>
          <mesh position={[0, radius * 0.45, 0]}>
            <icosahedronGeometry args={[radius * 0.22, 0]} />
            <meshStandardMaterial {...flat('#59b37a')} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Concentric discs slowly turning like a mandala (ambient motion only). */
export function RingStack({
  position,
  radius,
  colors,
}: {
  position: readonly [number, number, number];
  radius: number;
  colors: readonly string[];
}) {
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  useFrame((_, delta) => {
    refs.current.forEach((m, i) => {
      if (m) m.rotation.z += delta * 0.08 * (i % 2 ? -1 : 1);
    });
  });
  return (
    <group position={[...position]} rotation={[-0.35, 0.5, 0]}>
      {colors.map((c, i) => (
        <mesh
          key={c + i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          position={[0, 0, -i * 2.2]}
        >
          <torusGeometry args={[radius * (1 - i * 0.2), radius * 0.07, 6, 7 + i * 2]} />
          <meshStandardMaterial {...flat(c)} />
        </mesh>
      ))}
    </group>
  );
}

/** A slender spire topped with a glowing star, for the Proof area. */
export function Spire({
  position,
  height,
  color = '#f6efe4',
}: {
  position: readonly [number, number, number];
  height: number;
  color?: string;
}) {
  const star = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (star.current) star.current.rotation.y += delta * 0.6;
  });
  return (
    <group position={[...position]}>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[height * 0.07, height, 6]} />
        <meshStandardMaterial {...flat(color)} />
      </mesh>
      <mesh ref={star} position={[0, height + height * 0.06, 0]}>
        <octahedronGeometry args={[height * 0.09, 0]} />
        <meshBasicMaterial color={glow('#ffd23f', 1.6)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Lanterns / motes: small bright points scattered through a box. */
export function Motes({
  count,
  box,
  center,
  color,
  seed,
}: {
  count: number;
  box: readonly [number, number, number];
  center: readonly [number, number, number];
  color: string;
  seed: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = seeded(seed);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = center[0] + (rand() - 0.5) * box[0];
      pos[i * 3 + 1] = center[1] + (rand() - 0.5) * box[1];
      pos[i * 3 + 2] = center[2] + (rand() - 0.5) * box[2];
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, box, center, seed]);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: glow(color, 1.5),
        size: 3,
        sizeAttenuation: false,
        opacity: 0.9,
        depthWrite: false,
        // painted: the style pass inked round every 3 px point (dark squares on the street)
        ...PAINTED_BLEND,
      }),
    [color],
  );
  useDisposeOnUnmount(geo, mat);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** A road of light: glowing dashes down the flight line (one instanced draw call). */
export function LightRoad({
  y,
  from,
  to,
  step,
  color,
}: {
  y: number;
  from: number;
  to: number;
  step: number;
  color: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(1, Math.floor((from - to) / step));
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mx = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) m.setMatrixAt(i, mx.makeTranslation(0, y, from - i * step));
    m.instanceMatrix.needsUpdate = true;
  }, [count, y, from, step]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[6, 0.4, 3]} />
      <meshBasicMaterial color={glow(color, 1.6)} toneMapped={false} />
    </instancedMesh>
  );
}

/** A big ringed planet for the Horizon. */
export function RingedPlanet({
  position,
  radius,
  body = '#e9a8c8',
  ring = '#ffe3b5',
}: {
  position: readonly [number, number, number];
  radius: number;
  body?: string;
  ring?: string;
}) {
  return (
    <group position={[...position]} rotation={[0.35, 0, -0.25]}>
      {/* smooth and painted: flat facets were each inked and posterised into a striped ball */}
      <mesh>
        <sphereGeometry args={[radius, 64, 40]} />
        <meshStandardMaterial color={body} roughness={1} metalness={0} {...PAINTED_BLEND} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.35, radius * 2.0, 96]} />
        <meshBasicMaterial color={ring} side={THREE.DoubleSide} opacity={0.85} {...PAINTED_BLEND} />
      </mesh>
    </group>
  );
}

const SUN_DEFAULT: readonly [number, number, number] = [60, 55, -300];

const PAINTED_SUN_FRAG = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform vec3 uGlow;
  uniform float uHalo;
  varying vec2 vUv;
  void main() {
    // 1.0 = the disc's edge; the quad spans 3.2 radii
    float r = length(vUv - 0.5) * 2.0 * 3.2;
    float disc = 1.0 - smoothstep(0.985, 1.0, r);
    // the disc: warm white core, warming towards its rim
    vec3 col = mix(uCore, uEdge, smoothstep(0.55, 0.97, r));
    // the glow: a soft warm halo falling off into the sky
    float glow = (exp(-(r - 1.0) * 3.2) * 0.42 + exp(-(r - 1.0) * 1.1) * 0.12) * step(1.0, r);
    float a = max(disc, clamp(glow * uHalo, 0.0, 1.0));
    gl_FragColor = vec4(mix(uGlow, col, disc), a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const PAINTED_SUN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // camera-facing billboard, sized by the object's scale
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    c.xy += position.xy * length(modelMatrix[0].xyz);
    gl_Position = projectionMatrix * c;
  }`;

/**
 * The painted sun of the anime sky: a warm white disc with a crisp rim and a soft halo, always
 * facing the camera. Painted (no ink, no posterising; PAINTED_BLEND). Scale the mesh to shrink it.
 */
export function PaintedSun({
  radius,
  position,
  ref,
  halo = true,
}: {
  /** radius of the disc */
  radius: number;
  position: readonly [number, number, number];
  ref?: Ref<THREE.Group>;
  /** the soft glow round the disc (off over a dark backdrop, where it can only read as grey) */
  halo?: boolean;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          // under the bloom threshold (the style pass lifts painted pixels after AgX)
          uCore: { value: new THREE.Color(1.0, 0.98, 0.92) },
          uEdge: { value: new THREE.Color(0.98, 0.74, 0.42) },
          uGlow: { value: new THREE.Color(0.99, 0.88, 0.7) },
          uHalo: { value: halo ? 1 : 0 },
        },
        vertexShader: PAINTED_SUN_VERT,
        fragmentShader: PAINTED_SUN_FRAG,
        depthWrite: false,
        ...PAINTED_BLEND,
      }),
    [halo],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useDisposeOnUnmount(mat, geo);
  return (
    <group {...(ref ? { ref } : {})} position={[...position]}>
      <mesh
        geometry={geo}
        material={mat}
        scale={radius * 2 * 3.2}
        frustumCulled={false}
        renderOrder={-8}
      />
    </group>
  );
}

/** The painted sun's colour: under the bloom threshold like the clouds (the style pass lifts it). */
export const PAINTED_SUN = new THREE.Color(0.9, 0.78, 0.6);

/**
 * Blend settings that mark a surface as already painted: colour blends normally, and the
 * framebuffer alpha moves towards a constant 0.5 as the surface covers a pixel (from 1 over drawn
 * scenery, from 0 over empty space). The style pass reads it as "no ink, no posterising" and still
 * tells empty space apart (shaders/styleBlend.ts paintedCover). Spread onto a material.
 */
export const PAINTED_BLEND = {
  transparent: true,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ConstantAlphaFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  blendAlpha: 0.5,
} as const;

const PUFF_VERT = /* glsl */ `
  // instanceMatrix is used as a record, not a transform (PaintedPuffs below):
  //   col 3 xyz = centre, col 0 x = width, col 0 y = height, col 1 x = seed, col 1 y = palette
  varying vec2 vP;
  varying float vSeed;
  varying float vPal;
  varying vec3 vSun;
  varying float vFade;
  varying float vDist;
  uniform vec3 uSun;
  void main() {
    vec3 centre = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float w = instanceMatrix[0].x;
    float h = instanceMatrix[0].y;
    vSeed = instanceMatrix[1].x;
    vPal = instanceMatrix[1].y;
    // upright billboard: faces the camera round the vertical axis, so towers stay upright
    vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
    vec3 up = vec3(0.0, 1.0, 0.0);
    right = normalize(right - up * dot(right, up));
    vec3 toCam = cameraPosition - centre;
    vec3 fwd = normalize(cross(right, up));
    if (dot(fwd, toCam) < 0.0) fwd = -fwd;
    vec3 world = centre + right * position.x * w + up * position.y * h;
    vP = position.xy * 2.0;
    vSun = vec3(dot(uSun, right), dot(uSun, up), dot(uSun, fwd));
    vDist = length(toCam);
    // puffs the camera flies through dissolve instead of slicing past the lens
    vFade = smoothstep(w * 0.25, w * 0.9, vDist);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;

const PAINT_NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }`;

const PUFF_FRAG = /* glsl */ `
  // four tones per palette (light, mid, shade, deep), up to four palettes
  uniform vec3 uPal[16];
  uniform vec3 uHaze;
  uniform float uHazeNear;
  uniform float uHazeFar;
  uniform float uOpacity;
  varying vec2 vP;
  varying float vSeed;
  varying float vPal;
  varying vec3 vSun;
  varying float vFade;
  varying float vDist;
  ${PAINT_NOISE}
  float r1(float k) { return fract(sin(vSeed * 12.9898 + k * 78.233) * 43758.5453); }

  void main() {
    vec2 p = vP; // x, y in [-1, 1]
    // cauliflower edges: warp the puff field with noise
    vec2 pw = p + (vec2(fbm(p * 2.6 + vSeed), fbm(p * 2.6 - vSeed * 1.7)) - 0.5) * 0.16;
    float field = 0.0;
    float front = -9.0;
    vec3 nrm = vec3(0.0, 0.0, 1.0);
    for (int i = 0; i < 13; i++) {
      float fi = float(i);
      float a = r1(fi * 3.1 + 1.0) - 0.5;
      float tower = 1.0 - abs(a) * 1.5;
      // puffs pile up from a flat base: higher and bigger towards the middle
      vec2 c = vec2(a * 1.3, -0.45 + r1(fi * 5.7 + 2.0) * 0.95 * tower * tower);
      float r = (0.16 + r1(fi * 1.9 + 3.0) * 0.17) * (0.6 + 0.6 * tower);
      vec2 q = (pw - c) / r;
      float d2 = dot(q, q);
      field = max(field, 1.0 - d2);
      if (d2 < 1.0) {
        float z = (r1(fi * 7.3 + 4.0) - 0.5) * 0.25 + sqrt(1.0 - d2) * r + c.y * 0.15;
        if (z > front) { front = z; nrm = vec3(q, sqrt(1.0 - d2)); }
      }
    }
    // flat, slightly ragged base
    float base = smoothstep(-0.62, -0.5, p.y + (fbm(vec2(p.x * 5.0, vSeed)) - 0.5) * 0.06);
    // crisp, painted edge (a soft one blends over SC10's black space, before the style pass paints
    // its sky in, and leaves a dark fringe)
    float cover = smoothstep(0.0, 0.025, field) * base;
    if (cover < 0.01) discard;

    // small billows on every puff: bend the normal with the noise gradient
    vec2 e = vec2(0.02, 0.0);
    float n0 = fbm(pw * 7.0 + vSeed);
    vec2 g = vec2(fbm(pw * 7.0 + vSeed + e.xy) - n0, fbm(pw * 7.0 + vSeed + e.yx) - n0) / e.x;
    vec3 n = normalize(nrm + vec3(-g * 0.03, 0.0));

    // the sun's side is kept, but always a little in front: painted puffs are lit, not silhouettes
    vec3 L = normalize(vec3(vSun.xy + vec2(0.0, 0.35), max(vSun.z, 0.12)));
    float t = dot(n, L) * 0.5 + 0.5;
    // brush: streaky noise shifts the tone boundaries, so they read as strokes, not contours
    // a light touch: broad strokes shift the boundaries, never spotty patches
    float brush = fbm(vec2(p.x * 4.0, p.y * 2.0) + vSeed * 3.0);
    t += (brush - 0.5) * 0.14;
    // tops catch more light: crowns read bright even when the puff faces away
    t += smoothstep(-0.2, 0.9, p.y) * 0.12;
    int k = int(vPal + 0.5) * 4;
    vec3 cLight = uPal[k];
    vec3 cMid = uPal[k + 1];
    vec3 cShade = uPal[k + 2];
    vec3 cDeep = uPal[k + 3];
    vec3 col = cDeep;
    // a soft painted gradient through the shadows, a crisp edge only where the light begins
    col = mix(col, cShade, smoothstep(0.22, 0.42, t));
    col = mix(col, cMid, smoothstep(0.42, 0.6, t));
    col = mix(col, cLight, smoothstep(0.64, 0.68, t));
    // the underside sits in its own shadow
    col = mix(col, cDeep, smoothstep(-0.15, -0.55, p.y) * 0.55 * (1.0 - smoothstep(0.6, 0.8, t)));
    // (no silver lining: with the sun ahead it whitened every edge into a halo)
    // distance haze into the horizon colour (worlds only)
    col = mix(col, uHaze, smoothstep(uHazeNear, uHazeFar, vDist));

    gl_FragColor = vec4(col, cover * vFade * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Four painted tones (light, mid, shade, deep). Values stay under the bloom threshold. */
export type PaintedPalette = readonly [THREE.Color, THREE.Color, THREE.Color, THREE.Color];

/** The cloud palette: white crowns, sky-blue shadows. */
const CLOUD_PALETTE: readonly PaintedPalette[] = [
  [
    new THREE.Color(0.8, 0.8, 0.82),
    new THREE.Color(0.47, 0.52, 0.65),
    new THREE.Color(0.25, 0.31, 0.47),
    new THREE.Color(0.15, 0.19, 0.34),
  ],
];

/**
 * A painted foliage palette from one colour (sRGB hex): lit, base, and two cooler shadow tones.
 * Kept under the bloom threshold; the style pass lifts painted pixels after AgX.
 */
export function foliagePalette(hex: string): PaintedPalette {
  const c = new THREE.Color(hex);
  const cool = new THREE.Color(0.03, 0.05, 0.12);
  // a warm, yellower highlight on the lit crowns
  const warm = new THREE.Color(0.06, 0.06, 0.0);
  return [
    c.clone().multiplyScalar(1.12).add(warm),
    c.clone().multiplyScalar(0.78),
    c.clone().multiplyScalar(0.42).add(cool),
    c.clone().multiplyScalar(0.22).add(cool),
  ];
}

const NO_HAZE = {
  color: { value: new THREE.Color() },
  near: { value: 1e8 },
  far: { value: 1e9 },
};

/**
 * Painted puffs (anime reference: towering cauliflower clouds and foliage, light crowns, cool
 * shadows, brushy tones, no outlines). One instanced draw: each puff is an upright billboard whose
 * shader builds the silhouette from noise-warped blobs on a flat base, lights a pseudo-surface from
 * the sun, and paints it in four tones of its palette. They mark their pixels in the alpha channel
 * (PAINTED_BLEND), and the style pass (shaders/styleBlend.ts) leaves marked pixels un-inked and
 * un-posterised. Self-lit, not lit by the chapter's rig. Instances are re-sorted back to front
 * each frame (blending order).
 */
export function PaintedPuffs({
  items,
  palettes,
  sun = SUN_DEFAULT,
  haze,
  width = 3.4,
  height = 2.6,
  opacity,
}: {
  /** centre, size, and palette index (0..3, default 0) */
  items: ReadonlyArray<{ p: readonly [number, number, number]; s: number; k?: number }>;
  palettes: readonly PaintedPalette[];
  /** direction towards the sun (any length) */
  sun?: readonly [number, number, number];
  /** fade into the world's horizon colour with distance */
  haze?: { color: { value: THREE.Color }; near: { value: number }; far: { value: number } };
  /** billboard width and height per unit of size */
  width?: number;
  height?: number;
  /** read every frame (a pure function of t, written by the scene); default 1 */
  opacity?: { readonly current: number } | undefined;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => {
    const pal: THREE.Color[] = [];
    for (let i = 0; i < 4; i += 1) pal.push(...(palettes[i] ?? palettes[0]!));
    const h = haze ?? NO_HAZE;
    return new THREE.ShaderMaterial({
      uniforms: {
        uSun: { value: new THREE.Vector3(...sun).normalize() },
        uPal: { value: pal },
        uHaze: h.color,
        uHazeNear: h.near,
        uHazeFar: h.far,
        uOpacity: { value: 1 },
      },
      vertexShader: PUFF_VERT,
      fragmentShader: PUFF_FRAG,
      depthWrite: false,
      ...PAINTED_BLEND,
    });
  }, [palettes, sun, haze]);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useDisposeOnUnmount(mat, geo);

  // one record per puff (centre, size, seed, palette); the draw order is rebuilt each frame
  const records = useMemo(
    () =>
      items.map((c, i) => ({
        x: c.p[0],
        y: c.p[1],
        z: c.p[2],
        w: c.s * width,
        h: c.s * height,
        seed: 1 + i * 1.618,
        k: c.k ?? 0,
      })),
    [items, width, height],
  );
  const order = useMemo(() => records.map((_, i) => i), [records]);
  const dist = useMemo(() => new Float32Array(records.length), [records]);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    if (opacity) {
      mat.uniforms['uOpacity']!.value = opacity.current;
      m.visible = opacity.current > 0.002;
    }
    if (!m.visible) return;
    m.updateWorldMatrix(true, false);
    const e = m.matrixWorld.elements;
    const cx = camera.position.x - e[12]!;
    const cy = camera.position.y - e[13]!;
    const cz = camera.position.z - e[14]!;
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i]!;
      dist[i] = (r.x - cx) ** 2 + (r.y - cy) ** 2 + (r.z - cz) ** 2;
    }
    order.sort((a, b) => dist[b]! - dist[a]!);
    const arr = m.instanceMatrix.array as Float32Array;
    for (let j = 0; j < order.length; j += 1) {
      const r = records[order[j]!]!;
      const o = j * 16;
      arr.fill(0, o, o + 16);
      arr[o] = r.w;
      arr[o + 1] = r.h;
      arr[o + 4] = r.seed;
      arr[o + 5] = r.k;
      arr[o + 12] = r.x;
      arr[o + 13] = r.y;
      arr[o + 14] = r.z;
      arr[o + 15] = 1;
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, records.length]} frustumCulled={false} />;
}

/**
 * Painted cumulus: the cloud palette on PaintedPuffs. Shared by SC10, SC11-A and SC12, so the
 * clouds are the same across their joins.
 */
export function Clouds({
  items,
  sun = SUN_DEFAULT,
  opacity,
}: {
  items: ReadonlyArray<{ p: readonly [number, number, number]; s: number }>;
  /** direction towards the sun (any length) */
  sun?: readonly [number, number, number];
  opacity?: { readonly current: number };
}) {
  return <PaintedPuffs items={items} palettes={CLOUD_PALETTE} sun={sun} opacity={opacity} />;
}

const RANGE_FRAG = /* glsl */ `
  uniform vec3 uLit;
  uniform vec3 uShadow;
  uniform vec3 uHaze;
  uniform vec3 uSun;
  uniform float uSeed;
  uniform float uFreq;
  uniform float uLow;
  uniform float uHigh;
  uniform float uAerial;
  // width of the lit/shaded flank transition (wide: a calm gradient, no hard columns)
  uniform float uSoft;
  varying vec2 vUv;
  ${PAINT_NOISE}
  // the broad shape of the range (lighting follows it)
  float massif(float a) { return fbm(vec2(cos(a), sin(a)) * uFreq * 0.5 + uSeed); }
  // ridge height (0..1 of the band) at angle a: rolling fbm with sharper ridged peaks on top
  float ridge(float a) {
    vec2 c = vec2(cos(a), sin(a)) * uFreq + uSeed;
    float n = fbm(c);
    float peaks = 1.0 - abs(fbm(c * 2.1 + 5.0) * 2.0 - 1.0);
    return mix(uLow, uHigh, clamp(n * 0.75 + peaks * n * 0.6, 0.0, 1.0));
  }
  void main() {
    float a = vUv.x * 6.2831853;
    float h = ridge(a);
    float w = fwidth(vUv.y) * 1.5;
    float cover = 1.0 - smoothstep(h - w, h, vUv.y);
    if (cover < 0.01) discard;
    // which flank faces the sun: the slope of the broad massif (not of every small wiggle, which
    // striped the range like curtains) against the sun's bearing. CylinderGeometry puts angle a at
    // (sin a, cos a); the band's tangent is (cos a, -sin a).
    float slope = massif(a + 0.03) - massif(a - 0.03);
    vec2 tangent = vec2(cos(a), -sin(a));
    float facing = -slope * dot(tangent, normalize(uSun.xz)) * 18.0;
    // a few soft gullies running down from the ridge, and more light higher up
    float gully = fbm(vec2(a * 22.0, vUv.y * 1.5) + uSeed) - 0.5;
    float lit = smoothstep(-uSoft, uSoft, facing + gully * 0.06 + (vUv.y / h - 0.55) * 0.25);
    vec3 col = mix(uShadow, uLit, lit);
    // the foot dissolves into the haze, and the whole range sits back in the air
    col = mix(col, uHaze, smoothstep(h * 0.55, 0.0, vUv.y) * 0.8);
    col = mix(col, uHaze, uAerial);
    gl_FragColor = vec4(col, cover);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const RANGE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/**
 * A painted mountain range round the horizon: an open band (seen from inside) whose top edge is a
 * seamless noise ridge, with sunlit and shaded flanks, gullies, and a foot that dissolves into the
 * haze. Painted (no ink, no posterising), like the clouds. Place it in a group that follows the
 * ship, so it stays on the horizon.
 */
export function PaintedRange({
  radius,
  y,
  height,
  lit,
  shadow,
  haze,
  seed = 1,
  freq = 2.2,
  low = 0.25,
  high = 0.95,
  aerial = 0,
  soft = 0.4,
  sun = SUN_DEFAULT,
}: {
  radius: number;
  /** bottom of the band */
  y: number;
  height: number;
  lit: string;
  shadow: string;
  haze: { color: { value: THREE.Color } };
  seed?: number;
  freq?: number;
  low?: number;
  high?: number;
  /** how far the whole range sits back into the haze, 0..1 */
  aerial?: number;
  /** width of the lit/shaded flank transition; large = an even gradient */
  soft?: number;
  sun?: readonly [number, number, number];
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uLit: { value: new THREE.Color(lit) },
          uShadow: { value: new THREE.Color(shadow) },
          uHaze: haze.color,
          uSun: { value: new THREE.Vector3(...sun).normalize() },
          uSeed: { value: seed },
          uFreq: { value: freq },
          uLow: { value: low },
          uHigh: { value: high },
          uAerial: { value: aerial },
          uSoft: { value: soft },
        },
        vertexShader: RANGE_VERT,
        fragmentShader: RANGE_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        ...PAINTED_BLEND,
      }),
    [lit, shadow, haze, sun, seed, freq, low, high, aerial, soft],
  );
  const geo = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, height, 160, 1, true),
    [radius, height],
  );
  useDisposeOnUnmount(mat, geo);
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[0, y + height / 2, 0]}
      renderOrder={-9}
      frustumCulled={false}
    />
  );
}
