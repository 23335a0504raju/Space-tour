import { useEffect, useMemo, useRef } from 'react';
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
}: {
  colors: readonly [string, string, string, string];
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
      }),
    [colors],
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

/** A torii-style gate: two pillars, a top beam and a tie beam. */
export function Torii({
  position,
  scale = 1,
  color = '#d6443f',
}: {
  position: readonly [number, number, number];
  scale?: number;
  color?: string;
}) {
  return (
    <group position={[...position]} scale={scale}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 17, 17, 0]}>
          <cylinderGeometry args={[1.5, 1.8, 34, 8]} />
          <meshStandardMaterial {...flat(color)} />
        </mesh>
      ))}
      <mesh position={[0, 33, 0]}>
        <boxGeometry args={[50, 3, 3.4]} />
        <meshStandardMaterial {...flat(color)} />
      </mesh>
      <mesh position={[0, 27, 0]}>
        <boxGeometry args={[36, 1.8, 2.2]} />
        <meshStandardMaterial {...flat('#2b2440')} />
      </mesh>
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
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
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
      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial {...flat(body)} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 1.35, radius * 2.0, 64]} />
        <meshBasicMaterial color={ring} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

const SUN_DEFAULT: readonly [number, number, number] = [60, 55, -300];

const CLOUD_VERT = /* glsl */ `
  // instanceMatrix is used as a record, not a transform (Clouds below):
  //   col 3 xyz = centre, col 0 x = width, col 0 y = height, col 1 x = seed
  varying vec2 vP;
  varying float vSeed;
  varying vec3 vSun;
  varying float vFade;
  uniform vec3 uSun;
  void main() {
    vec3 centre = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float w = instanceMatrix[0].x;
    float h = instanceMatrix[0].y;
    vSeed = instanceMatrix[1].x;
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
    // clouds the camera flies through dissolve instead of slicing past the lens
    vFade = smoothstep(w * 0.25, w * 0.9, length(toCam));
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;

const CLOUD_FRAG = /* glsl */ `
  uniform vec3 uLight;
  uniform vec3 uMid;
  uniform vec3 uShade;
  uniform vec3 uDeep;
  varying vec2 vP;
  varying float vSeed;
  varying vec3 vSun;
  varying float vFade;

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
  }
  float r1(float k) { return fract(sin(vSeed * 12.9898 + k * 78.233) * 43758.5453); }

  void main() {
    vec2 p = vP; // x, y in [-1, 1]
    // cauliflower edges: warp the puff field with noise
    vec2 pw = p + (vec2(fbm(p * 2.6 + vSeed), fbm(p * 2.6 - vSeed * 1.7)) - 0.5) * 0.16;
    float field = 0.0;
    float front = -9.0;
    vec3 nrm = vec3(0.0, 0.0, 1.0);
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float a = r1(fi * 3.1 + 1.0) - 0.5;
      float tower = 1.0 - abs(a) * 1.5;
      // puffs pile up from a flat base: higher and bigger towards the middle
      vec2 c = vec2(a * 1.25, -0.42 + r1(fi * 5.7 + 2.0) * 0.75 * tower);
      float r = (0.22 + r1(fi * 1.9 + 3.0) * 0.2) * (0.65 + 0.55 * tower);
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
    float cover = smoothstep(0.0, 0.07, field) * base;
    if (cover < 0.01) discard;

    // small billows on every puff: bend the normal with the noise gradient
    vec2 e = vec2(0.02, 0.0);
    float n0 = fbm(pw * 7.0 + vSeed);
    vec2 g = vec2(fbm(pw * 7.0 + vSeed + e.xy) - n0, fbm(pw * 7.0 + vSeed + e.yx) - n0) / e.x;
    vec3 n = normalize(nrm + vec3(-g * 0.06, 0.0));

    // the sun's side is kept, but always a little in front: painted clouds are lit, not silhouettes
    vec3 L = normalize(vec3(vSun.xy, max(vSun.z, 0.45)));
    float t = dot(n, L) * 0.5 + 0.5;
    // brush: streaky noise shifts the tone boundaries, so they read as strokes, not contours
    float brush = fbm(vec2(p.x * 9.0, p.y * 3.5) + vSeed * 3.0);
    t += (brush - 0.5) * 0.3;
    vec3 col = uDeep;
    col = mix(col, uShade, smoothstep(0.3, 0.36, t));
    col = mix(col, uMid, smoothstep(0.52, 0.57, t));
    col = mix(col, uLight, smoothstep(0.68, 0.72, t));
    // the underside sits in its own shadow
    col = mix(col, uDeep, smoothstep(-0.15, -0.55, p.y) * 0.55 * (1.0 - smoothstep(0.6, 0.8, t)));
    // sun behind the cloud: a bright lining round the edge
    float lining = (1.0 - smoothstep(0.0, 0.3, field)) * smoothstep(0.0, -0.6, vSun.z);
    col = mix(col, uLight, lining * 0.8);

    gl_FragColor = vec4(col, cover * vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * Painted cumulus (anime reference: towering cauliflower clouds, white crowns, sky-tinted shadows,
 * brushy tones, no outlines). One instanced draw: each cloud is an upright billboard whose shader
 * builds the silhouette from noise-warped puffs on a flat base, lights a pseudo-surface from the
 * sun, and paints it in four tones. They mark their pixels in the alpha channel (CustomBlending
 * below), and the style pass (shaders/styleBlend.ts) leaves marked pixels un-inked and
 * un-posterised. Self-lit, not lit by the chapter's rig, so SC10, SC11-A and SC12 show the same
 * clouds across their joins. Instances are re-sorted back to front each frame (blending order).
 */
export function Clouds({
  items,
  sun = SUN_DEFAULT,
}: {
  items: ReadonlyArray<{ p: readonly [number, number, number]; s: number }>;
  /** direction towards the sun (any length) */
  sun?: readonly [number, number, number];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: new THREE.Vector3(...sun).normalize() },
          // HDR: AgX shows ~1 as grey; the crowns must read as white
          uLight: { value: new THREE.Color(2.3, 2.3, 2.35) },
          uMid: { value: new THREE.Color(1.35, 1.5, 1.85) },
          uShade: { value: new THREE.Color(0.72, 0.88, 1.35) },
          uDeep: { value: new THREE.Color(0.42, 0.55, 0.98) },
        },
        vertexShader: CLOUD_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
        // colour: normal alpha blending; alpha: multiplied by (1 - coverage), the "painted" mark
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      }),
    [sun],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useDisposeOnUnmount(mat, geo);

  // one record per cloud (centre, size, seed); the draw order is rebuilt from it each frame
  const records = useMemo(
    () =>
      items.map((c, i) => ({
        x: c.p[0],
        y: c.p[1],
        z: c.p[2],
        w: c.s * 3.4,
        h: c.s * 2.6,
        seed: 1 + i * 1.618,
      })),
    [items],
  );
  const order = useMemo(() => records.map((_, i) => i), [records]);
  const dist = useMemo(() => new Float32Array(records.length), [records]);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m || !m.visible) return;
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
    for (let k = 0; k < order.length; k += 1) {
      const r = records[order[k]!]!;
      const o = k * 16;
      arr.fill(0, o, o + 16);
      arr[o] = r.w;
      arr[o + 1] = r.h;
      arr[o + 4] = r.seed;
      arr[o + 12] = r.x;
      arr[o + 13] = r.y;
      arr[o + 14] = r.z;
      arr[o + 15] = 1;
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, records.length]} frustumCulled={false} />;
}
