import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { ROOM } from './layout.ts';

/**
 * The room's exit: a sci-fi bi-parting door on the +x wall (P3 review: the single slab slid out
 * into the room past the wall and the opening showed a black gap with stars).
 *  - A chunky frame with jambs, header and light lines, standing proud of the wall.
 *  - A reveal (wall thickness) whose side linings hide the leaves as they retract into the pockets.
 *  - Two leaves with inset panels, an amber band and a lit meeting edge, sliding apart.
 *  - A short bright corridor beyond (the "light" the match cut goes white on), and a spill light
 *    onto the room floor that rises with the opening.
 *  - A wall status light: red when sealed, green when open.
 * Everything is driven by `set(open)`, a pure function of story time in SC03.
 */
export interface DoorHandle {
  set(open: number): void;
}

const { halfW, doorZ, doorW, doorH } = ROOM;
const WALL_T = 0.24; // reveal depth
const LEAF_X = halfW + 0.1;
const LEAF_W = doorW / 2 + 0.02; // leaves overlap slightly at the meeting edge
const TRAVEL = doorW / 2 + 0.06; // fully inside the pockets when open
const CORRIDOR_X0 = halfW + WALL_T;
const CORRIDOR_L = 3.2;
const CORRIDOR_W = doorW + 0.5;
const CORRIDOR_H = doorH + 0.3;

const SEALED = new THREE.Color('#ff4538');
const OPEN = new THREE.Color('#3ee08a');

const FRAME = { color: '#23272e', metalness: 0.75, roughness: 0.4 } as const;
const LEAF = { color: '#4c535e', metalness: 0.7, roughness: 0.38 } as const;
const PANEL = { color: '#7a818c', metalness: 0.55, roughness: 0.45 } as const;

function Glow({
  position,
  size,
  color,
  intensity = 2,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  intensity?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#000000"
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
  );
}

/** One leaf, built around its own centre; `side` = -1 (towards -z) or +1. */
function Leaf({ side, shadows }: { side: -1 | 1; shadows: boolean }) {
  const inner = -side * (LEAF_W / 2 - 0.012); // meeting edge, local z
  const front = -0.03; // room-facing side, local x
  return (
    <>
      <mesh castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.05, doorH, LEAF_W]} />
        <meshStandardMaterial {...LEAF} />
      </mesh>
      {/* raised inset panel */}
      <mesh position={[front, -0.12, side * 0.03]} receiveShadow>
        <boxGeometry args={[0.012, doorH - 0.75, LEAF_W - 0.2]} />
        <meshStandardMaterial {...PANEL} />
      </mesh>
      {/* dark vision slot */}
      <mesh position={[front, doorH / 2 - 0.42, side * 0.03]}>
        <boxGeometry args={[0.014, 0.32, 0.1]} />
        <meshStandardMaterial color="#090b10" metalness={0.9} roughness={0.15} />
      </mesh>
      {/* amber band at hand height + lit meeting edge */}
      <Glow
        position={[front - 0.002, 1.1 - doorH / 2, 0]}
        size={[0.014, 0.045, LEAF_W]}
        color="#e8a345"
        intensity={1.6}
      />
      <Glow
        position={[front - 0.002, 0, inner]}
        size={[0.014, doorH - 0.3, 0.012]}
        color="#9fd4ff"
        intensity={1.8}
      />
    </>
  );
}

export const SlidingDoor = forwardRef<DoorHandle, { shadows: boolean }>(function SlidingDoor(
  { shadows },
  ref,
) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const spill = useRef<THREE.PointLight>(null);
  const status = useRef<THREE.MeshStandardMaterial>(null);

  useImperativeHandle(
    ref,
    () => ({
      set(open) {
        const k = Math.min(1, Math.max(0, open));
        if (left.current) left.current.position.z = doorZ - doorW / 4 - k * TRAVEL;
        if (right.current) right.current.position.z = doorZ + doorW / 4 + k * TRAVEL;
        if (spill.current) spill.current.intensity = 6 * k;
        // seal releases first: the light turns green at the start of the travel
        status.current?.emissive.copy(SEALED).lerp(OPEN, Math.min(1, k * 4));
      },
    }),
    [],
  );

  const jambZ = doorW / 2 + 0.07;
  return (
    <group name="Room_Door">
      {/* frame, standing proud of the wall into the room */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh
            position={[halfW - 0.04, (doorH + 0.14) / 2, doorZ + s * jambZ]}
            castShadow={shadows}
            receiveShadow
          >
            <boxGeometry args={[0.08, doorH + 0.14, 0.14]} />
            <meshStandardMaterial {...FRAME} />
          </mesh>
          <Glow
            position={[halfW - 0.085, doorH / 2, doorZ + s * (jambZ - 0.035)]}
            size={[0.01, doorH - 0.1, 0.018]}
            color="#9fd4ff"
            intensity={1.4}
          />
        </group>
      ))}
      <mesh position={[halfW - 0.04, doorH + 0.07, doorZ]} castShadow={shadows} receiveShadow>
        <boxGeometry args={[0.08, 0.14, doorW + 0.28]} />
        <meshStandardMaterial {...FRAME} />
      </mesh>
      <Glow
        position={[halfW - 0.085, doorH + 0.07, doorZ]}
        size={[0.01, 0.025, doorW]}
        color="#e8a345"
        intensity={2.2}
      />

      {/* reveal: side and top linings hide the leaves in their pockets; threshold plate */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[halfW + WALL_T / 2, doorH / 2, doorZ + s * (doorW / 2 + 0.01)]}>
          <boxGeometry args={[WALL_T, doorH, 0.02]} />
          <meshStandardMaterial {...FRAME} />
        </mesh>
      ))}
      <mesh position={[halfW + WALL_T / 2, doorH + 0.01, doorZ]}>
        <boxGeometry args={[WALL_T, 0.02, doorW + 0.04]} />
        <meshStandardMaterial {...FRAME} />
      </mesh>
      <mesh position={[halfW + WALL_T / 2 - 0.04, 0.008, doorZ]} receiveShadow>
        <boxGeometry args={[WALL_T + 0.08, 0.016, doorW]} />
        <meshStandardMaterial color="#3a3f47" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* leaves (closed pose; `set` moves them) */}
      <group ref={left} position={[LEAF_X, doorH / 2, doorZ - doorW / 4]}>
        <Leaf side={-1} shadows={shadows} />
      </group>
      <group ref={right} position={[LEAF_X, doorH / 2, doorZ + doorW / 4]}>
        <Leaf side={1} shadows={shadows} />
      </group>

      {/* wall status light beside the door */}
      <group position={[halfW - 0.02, 1.3, doorZ - jambZ - 0.32]}>
        <mesh>
          <boxGeometry args={[0.03, 0.22, 0.13]} />
          <meshStandardMaterial {...FRAME} />
        </mesh>
        <mesh position={[-0.017, 0.05, 0]}>
          <boxGeometry args={[0.01, 0.035, 0.07]} />
          <meshStandardMaterial
            ref={status}
            color="#000000"
            emissive={SEALED}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.017, -0.04, 0]}>
          <boxGeometry args={[0.008, 0.08, 0.08]} />
          <meshStandardMaterial color="#0c0f14" metalness={0.6} roughness={0.25} />
        </mesh>
      </group>

      {/* the bright corridor beyond: unlit, so it reads as light, not as a lit surface */}
      <group position={[CORRIDOR_X0 + CORRIDOR_L / 2, 0, doorZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CORRIDOR_L, CORRIDOR_W]} />
          <meshBasicMaterial color="#b4bcc7" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CORRIDOR_H, 0]}>
          <planeGeometry args={[CORRIDOR_L, CORRIDOR_W]} />
          <meshBasicMaterial color="#e9eef4" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[0, CORRIDOR_H / 2, -s * (CORRIDOR_W / 2)]}
            rotation={[0, s > 0 ? 0 : Math.PI, 0]}
          >
            <planeGeometry args={[CORRIDOR_L, CORRIDOR_H]} />
            <meshBasicMaterial color="#d6dce4" />
          </mesh>
        ))}
        {/* ceiling light bars and floor guide lines: perspective cues */}
        {[-1.1, -0.2, 0.7].map((x) => (
          <mesh key={x} position={[x, CORRIDOR_H - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.18, CORRIDOR_W - 0.3]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[0, 0.002, s * (CORRIDOR_W / 2 - 0.12)]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[CORRIDOR_L, 0.03]} />
            <meshBasicMaterial color="#e8a345" />
          </mesh>
        ))}
        <mesh position={[CORRIDOR_L / 2, CORRIDOR_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[CORRIDOR_W, CORRIDOR_H]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>
      <pointLight
        ref={spill}
        position={[halfW + 0.7, 1.9, doorZ]}
        color="#e6efff"
        intensity={0}
        distance={5}
        decay={2}
      />
    </group>
  );
});
