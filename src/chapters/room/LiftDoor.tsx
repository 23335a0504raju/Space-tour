import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';

/**
 * The lift door (lift → cockpit join, handoff: SC03 → SC04). The astronaut steps into the lift on
 * the bridge, the door slides shut as the camera closes in until it fills the frame; in the cockpit
 * the same door, seen from the same distance, slides open and he steps out. It is drawn unlit with
 * one shared texture, so it looks identical in both chapters whatever their lighting.
 */
export const DOOR = { width: 1.1, height: 2.3 } as const;
export { DOOR_VIEW } from './doorView.ts';

let texture: THREE.CanvasTexture | null = null;
/** Brushed dark metal, a centre seam, panel grooves and a lit status strip (made once). */
function doorTexture(): THREE.CanvasTexture {
  if (texture) return texture;
  const w = 512;
  const h = 1072;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3d434d');
  grad.addColorStop(0.5, '#353a43');
  grad.addColorStop(1, '#2b3038');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // brushed grain (seeded, so it is the same every visit)
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 2600; i += 1) {
    const y = rand() * h;
    g.fillStyle = `rgba(255,255,255,${(0.012 + rand() * 0.025).toFixed(3)})`;
    g.fillRect(rand() * w, y, 30 + rand() * 120, 1);
  }
  // panel grooves
  g.strokeStyle = 'rgba(10,12,16,0.85)';
  g.lineWidth = 3;
  for (const y of [h * 0.18, h * 0.62, h * 0.86]) {
    g.beginPath();
    g.moveTo(18, y);
    g.lineTo(w - 18, y);
    g.stroke();
  }
  g.strokeRect(18, 18, w - 36, h - 36);
  // the centre seam between the two halves
  g.fillStyle = '#0d0f13';
  g.fillRect(w / 2 - 3, 0, 6, h);
  // lit status strip and a small floor label
  const strip = g.createLinearGradient(0, h * 0.44, 0, h * 0.47);
  strip.addColorStop(0, 'rgba(79,216,255,0)');
  strip.addColorStop(0.5, 'rgba(120,226,255,0.95)');
  strip.addColorStop(1, 'rgba(79,216,255,0)');
  g.fillStyle = strip;
  g.fillRect(60, h * 0.44, w - 120, h * 0.03);
  g.fillStyle = 'rgba(214,167,86,0.9)';
  g.font = '600 30px monospace';
  g.textAlign = 'center';
  g.fillText('LIFT · DECK 2', w / 2, h * 0.53);
  texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The door, centred on `position` (its bottom on the floor), its face turned by `rotationY` toward
 * the camera. `open` is read every frame (0 = shut, 1 = both halves slid away): story time drives
 * it, never React state.
 */
export function LiftDoor({
  position,
  rotationY,
  open,
}: {
  position: readonly [number, number, number];
  /** turns the door so its face points at the camera (0 faces +z) */
  rotationY: number;
  open: { readonly current: number };
}) {
  const [leftMat, rightMat] = useMemo(() => {
    const map = doorTexture();
    const half = (k: number) => {
      const m = map.clone();
      m.needsUpdate = true;
      m.repeat.set(0.5, 1);
      m.offset.set(k * 0.5, 0);
      return new THREE.MeshBasicMaterial({ map: m });
    };
    return [half(0), half(1)] as const;
  }, []);
  useDisposeOnUnmount(leftMat, rightMat, leftMat.map!, rightMat.map!);
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const half = DOOR.width / 2;
  useFrame(() => {
    const o = Math.min(1, Math.max(0, open.current));
    const slide = o * (half + 0.02);
    if (group.current) group.current.visible = o < 0.999;
    left.current?.position.set(-half / 2 - slide, DOOR.height / 2, 0);
    right.current?.position.set(half / 2 + slide, DOOR.height / 2, 0);
  });
  return (
    <group ref={group} position={[...position]} rotation={[0, rotationY, 0]}>
      <mesh ref={left} material={leftMat} position={[-half / 2, DOOR.height / 2, 0]}>
        <planeGeometry args={[half, DOOR.height]} />
      </mesh>
      <mesh ref={right} material={rightMat} position={[half / 2, DOOR.height / 2, 0]}>
        <planeGeometry args={[half, DOOR.height]} />
      </mesh>
    </group>
  );
}
