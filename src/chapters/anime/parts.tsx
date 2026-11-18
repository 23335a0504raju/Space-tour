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
export function SkyDome({ colors }: { colors: readonly [string, string, string, string] }) {
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

/** Painted clouds: flat white blobs (instanced). */
export function Clouds({
  items,
  color = '#f4f0ff',
}: {
  items: ReadonlyArray<{ p: readonly [number, number, number]; s: number }>;
  color?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((c, i) => {
      m.setMatrixAt(
        i,
        mx.compose(new THREE.Vector3(...c.p), q, new THREE.Vector3(c.s * 1.6, c.s * 0.7, c.s)),
      );
    });
    m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial {...flat(color)} />
    </instancedMesh>
  );
}
