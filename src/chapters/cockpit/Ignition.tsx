import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { createIgnitionLabelMaterial, createIgnitionRingMaterial } from '../../shaders/ignition.ts';
import { INK, createAtlasTexture, text } from '../holo/draw.ts';
import type { Ctx } from '../holo/draw.ts';
import type { IgnitionState } from './arrival.ts';
import { DASH, onDash } from './holoLayout.ts';

/**
 * The launch control in the middle of the panel (the close-up that ends SC04): a machined housing,
 * a domed red button under a hinged safety cover, arming rings of light and a label. The cover
 * lifts, the button goes down and the light goes from blue to gold, all from `state`, which the
 * chapter writes from story time (arrival.ts `ignitionAt`).
 */

/** Up the panel's slope from its centre. */
export const IGNITION_UP = -0.2;
/** How far the button travels, and how far the cover swings open (radians). */
const TRAVEL = 0.014;
const COVER_OPEN = -2.05;
/** The safety cover: its side, the height of its hinge over the panel (clear of the button). */
const COVER = { size: 0.128, height: 0.066, bar: 0.006 } as const;
const LABEL = { width: 0.19, height: 0.0475 } as const;

const IDLE = new THREE.Color('#ff1204');
const LIT = new THREE.Color('#ff6a00');
const RING_ARMING = new THREE.Color('#4fd8ff');
const RING_ARMED = new THREE.Color('#ffb04a');

const ATLAS = { width: 512, height: 256 } as const;

function label(value: string, colour: string) {
  return (ctx: Ctx) => {
    ctx.textAlign = 'center';
    text(ctx, value, ATLAS.width / 2, 84, 54, colour, true);
    ctx.textAlign = 'left';
  };
}

const createLabelAtlas = () =>
  createAtlasTexture(ATLAS, [
    [{ x: 0, y: 0, w: 512, h: 128 }, label('IGNITION', INK.pale)],
    [{ x: 0, y: 128, w: 512, h: 128 }, label('LAUNCH', INK.gold)],
  ]);

/** The arming rings: one quad on the panel, one floating over the button. */
function ringGeometry() {
  const parts = [
    { size: 0.29, z: 0.011, layer: 0 },
    { size: 0.23, z: 0.07, layer: 1 },
  ].map(({ size, z, layer }) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.translate(0, 0, z);
    g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(4).fill(layer), 1));
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('ignition rings could not be merged');
  return merged;
}

type Box = readonly [w: number, h: number, d: number, x: number, y: number, z: number];

function boxes(list: readonly Box[]) {
  const parts = list.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('ignition cover could not be merged');
  return merged;
}

const { size: SIDE, height: HINGE, bar: BAR } = COVER;
/** The lid's frame, relative to its hinge (along the left edge). */
const LID: readonly Box[] = [
  [BAR * 1.6, SIDE, BAR * 1.6, 0, 0, 0], // hinge pin
  [BAR, SIDE, BAR, SIDE, 0, 0],
  [SIDE, BAR, BAR, SIDE / 2, SIDE / 2, 0],
  [SIDE, BAR, BAR, SIDE / 2, -SIDE / 2, 0],
];
/** The two posts that carry the hinge, fixed to the panel. */
const POSTS: readonly Box[] = [-1, 1].map((k): Box => [
  BAR * 1.5,
  BAR * 1.5,
  HINGE,
  -SIDE / 2,
  (k * SIDE) / 2,
  HINGE / 2,
]);

/** The dark recessed plate the control sits in: a rectangle with cut corners. */
function plateGeometry() {
  const [w, h, cut] = [0.25, 0.152, 0.045];
  const shape = new THREE.Shape(
    (
      [
        [-w + cut, -h],
        [w - cut, -h],
        [w, -h + cut],
        [w, h - cut],
        [w - cut, h],
        [-w + cut, h],
        [-w, h - cut],
        [-w, -h + cut],
      ] as const
    ).map(([x, y]) => new THREE.Vector2(x, y)),
  );
  return new THREE.ExtrudeGeometry(shape, { depth: 0.007, bevelEnabled: false });
}

export function Ignition({ state }: { state: IgnitionState }) {
  const button = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Group>(null);
  const kit = useMemo(() => {
    const atlas = createLabelAtlas();
    return {
      atlas,
      rings: ringGeometry(),
      ringsMaterial: createIgnitionRingMaterial(),
      labelMaterial: createIgnitionLabelMaterial(atlas),
      lid: boxes(LID),
      posts: boxes(POSTS),
      plate: plateGeometry(),
      brass: new THREE.MeshStandardMaterial({ color: '#c28a3a', metalness: 0.8, roughness: 0.35 }),
      cap: new THREE.MeshStandardMaterial({
        color: '#4a0503',
        emissive: IDLE.clone(),
        emissiveIntensity: 0.28,
        roughness: 0.22,
        metalness: 0.3,
      }),
      collar: new THREE.MeshBasicMaterial({ color: RING_ARMING.clone(), toneMapped: false }),
    };
  }, []);
  useDisposeOnUnmount(
    kit.atlas,
    kit.rings,
    kit.ringsMaterial,
    kit.labelMaterial,
    kit.lid,
    kit.posts,
    kit.plate,
    kit.brass,
    kit.cap,
    kit.collar,
  );

  useFrame(({ clock }) => {
    const { show, arm, press, fire } = state;
    if (button.current) button.current.position.z = 0.036 - TRAVEL * press;
    if (cover.current) cover.current.rotation.y = COVER_OPEN * arm;
    kit.cap.emissive.copy(IDLE).lerp(LIT, fire);
    kit.cap.emissiveIntensity = 0.28 + 0.27 * arm + 0.85 * fire;
    kit.collar.color.copy(RING_ARMING).lerp(RING_ARMED, THREE.MathUtils.smoothstep(arm, 0.75, 1));
    for (const m of [kit.ringsMaterial, kit.labelMaterial]) {
      const u = m.uniforms;
      if (u['uTime']) u['uTime'].value = clock.elapsedTime;
      if (u['uShow']) u['uShow'].value = show;
      if (u['uArm']) u['uArm'].value = arm;
      if (u['uFire']) u['uFire'].value = fire;
    }
  });

  return (
    <>
      <group position={onDash(0, IGNITION_UP)} rotation={[-DASH.tilt, 0, 0]}>
        <mesh geometry={kit.plate}>
          <meshStandardMaterial color="#10141b" metalness={0.6} roughness={0.55} />
        </mesh>
        {/* machined housing */}
        <mesh position={[0, 0, 0.007]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.084, 0.098, 0.016, 48]} />
          <meshStandardMaterial color="#262b34" metalness={0.85} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0, 0.019]}>
          <torusGeometry args={[0.058, 0.009, 14, 48]} />
          <meshStandardMaterial color="#aab2bf" metalness={0.95} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.0165]} material={kit.collar}>
          <torusGeometry args={[0.072, 0.0022, 8, 64]} />
        </mesh>
        {/* the button */}
        <group ref={button} position={[0, 0, 0.036]}>
          <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]} material={kit.cap}>
            <cylinderGeometry args={[0.039, 0.042, 0.03, 40]} />
          </mesh>
          <mesh position={[0, 0, 0.003]} scale={[1, 1, 0.34]} material={kit.cap}>
            <sphereGeometry args={[0.039, 40, 20]} />
          </mesh>
        </group>
        {/* safety cover, hinged along its left edge */}
        <mesh geometry={kit.posts} material={kit.brass} />
        <group ref={cover} position={[-COVER.size / 2, 0, COVER.height]}>
          <mesh geometry={kit.lid} material={kit.brass} />
          <mesh position={[COVER.size / 2, 0, 0]}>
            <planeGeometry args={[COVER.size, COVER.size]} />
            <meshStandardMaterial
              color="#ff6a4a"
              transparent
              opacity={0.16}
              depthWrite={false}
              roughness={0.08}
              metalness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        <mesh geometry={kit.rings} material={kit.ringsMaterial} renderOrder={1} />
      </group>
      {/* the label, over the panel above the button, turned to the camera */}
      <mesh
        position={[-0.01, 1.035, -1.2]}
        rotation={[-0.5, 0.36, 0, 'YXZ']}
        material={kit.labelMaterial}
        renderOrder={2}
      >
        <planeGeometry args={[LABEL.width, LABEL.height]} />
      </mesh>
    </>
  );
}
