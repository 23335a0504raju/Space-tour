import { useMemo } from 'react';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';

/**
 * Spacecraft cabin surfaces, generated in code (no texture files, nothing to license): smooth
 * composite wall panels with fine seams, and a non-slip grated deck. Shared by the room
 * (SC02/SC03) and the cockpit (SC04).
 */
export type CabinKind = 'wall' | 'ceiling' | 'floor';

const SIZE = 512;
const cache = new Map<string, HTMLCanvasElement>();

function canvas(key: string, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = textureContext(c);
  if (g) draw(g);
  cache.set(key, c);
  return c;
}

/** One composite panel: soft gradient, a fine seam on the edge and a shallow inset. */
function wallCanvas(): HTMLCanvasElement {
  return canvas('wall', (g) => {
    const grad = g.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, '#e6e9ee');
    grad.addColorStop(1, '#d3d8df');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#e9ecf0';
    g.fillRect(40, 40, SIZE - 80, SIZE - 80);
    g.strokeStyle = '#b4bbc6';
    g.lineWidth = 3;
    g.strokeRect(40, 40, SIZE - 80, SIZE - 80);
    g.strokeStyle = '#f6f8fa';
    g.lineWidth = 2;
    g.strokeRect(44, 44, SIZE - 88, SIZE - 88);
    g.strokeStyle = '#7f8794';
    g.lineWidth = 4;
    g.strokeRect(2, 2, SIZE - 4, SIZE - 4);
  });
}

function slots(g: CanvasRenderingContext2D, fill: string) {
  g.fillStyle = fill;
  const w = 104;
  const h = 22;
  for (let row = 0; row < 8; row += 1) {
    const y = row * 64 + 21;
    const off = row % 2 === 0 ? 0 : 64;
    for (let col = -1; col < 4; col += 1) {
      const x = col * 128 + off + 12;
      g.beginPath();
      g.roundRect(x, y, w, h, h / 2);
      g.fill();
    }
  }
}

/** Deck grating: dark plate with rows of staggered oblong slots. */
function floorCanvas(): HTMLCanvasElement {
  return canvas('floor', (g) => {
    g.fillStyle = '#3a404a';
    g.fillRect(0, 0, SIZE, SIZE);
    slots(g, '#171a20');
    g.strokeStyle = '#2b3038';
    g.lineWidth = 6;
    g.strokeRect(0, 0, SIZE, SIZE);
  });
}

function floorBumpCanvas(): HTMLCanvasElement {
  return canvas('floorBump', (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, SIZE, SIZE);
    slots(g, '#000000');
  });
}

const BASE = {
  wall: { color: '#b4bac4', roughness: 0.55, metalness: 0.05 },
  ceiling: { color: '#6b717c', roughness: 0.6, metalness: 0.05 },
  floor: { color: '#d4d8de', roughness: 0.7, metalness: 0.4 },
} as const;

function tile(c: HTMLCanvasElement, repeat: [number, number], srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A cabin surface material. `repeat` is tiles across / along the mesh's UVs (about 1 m each). */
export function useCabinSurface(
  kind: CabinKind,
  repeat: [number, number],
  color?: string,
): THREE.MeshStandardMaterial {
  const [rx, ry] = repeat;
  const { material, map, bump } = useMemo(() => {
    const m = tile(kind === 'floor' ? floorCanvas() : wallCanvas(), [rx, ry], true);
    const b = kind === 'floor' ? tile(floorBumpCanvas(), [rx, ry], false) : null;
    const mat = new THREE.MeshStandardMaterial({
      ...BASE[kind],
      map: m,
      ...(b ? { bumpMap: b, bumpScale: 1.5 } : {}),
      ...(color ? { color: new THREE.Color(color) } : {}),
    });
    return { material: mat, map: m, bump: b };
  }, [kind, rx, ry, color]);
  useDisposeOnUnmount(map, bump, material);
  return material;
}
