/**
 * Dev tool: a GLB set seen from straight above, in ROOM coordinates, cut at a chosen height so
 * walls and consoles show as obstacles and slabs above head height disappear. A 1 m grid and the
 * chapter layout (desk, seat, walk path, camera keys, lift, pit) are drawn on top. Driven by
 * scripts/plan-view.ts; never shipped (tools/ is not a build entry).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 1400;

export interface PlanOverlay {
  /** Polylines [x, z][] with a colour and a label. */
  readonly lines: ReadonlyArray<{
    pts: ReadonlyArray<readonly [number, number]>;
    color: string;
    label?: string;
    closed?: boolean;
  }>;
  /** Points with a label. */
  readonly points: ReadonlyArray<{
    x: number;
    z: number;
    color: string;
    label: string;
    r?: number;
  }>;
}

export interface PlanRequest {
  readonly url: string;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  /** Keep geometry below this height (room metres, deck at 0). */
  readonly cutY: number;
  /** Room-coordinate window: [minX, maxX] × [minZ, maxZ] (square). */
  readonly view: { minX: number; minZ: number; span: number };
  readonly overlay: PlanOverlay;
}

const wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.localClippingEnabled = true;
wrap?.appendChild(renderer.domElement);
const overlay = document.createElement('canvas');
overlay.width = SIZE;
overlay.height = SIZE;
wrap?.appendChild(overlay);

async function render(req: PlanRequest): Promise<{ triangles: number }> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060a');
  scene.add(new THREE.AmbientLight('#ffffff', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(3, 10, 2);
  scene.add(sun);
  const gltf = await new GLTFLoader().loadAsync(req.url);
  const model = gltf.scene;
  model.position.set(...req.position);
  model.rotation.y = req.rotationY;
  const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), req.cutY);
  let triangles = 0;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const index = m.geometry.index;
    triangles += (index ? index.count : (m.geometry.getAttribute('position')?.count ?? 0)) / 3;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      mat.clippingPlanes = [cut];
      mat.side = THREE.DoubleSide;
      mat.transparent = false;
      mat.opacity = 1;
    }
  });
  scene.add(model);
  const { minX, minZ, span } = req.view;
  // looking straight down: screen right = +x, screen down = +z
  const cam = new THREE.OrthographicCamera(minX, minX + span, -minZ, -(minZ + span), 0.1, 200);
  cam.position.set(0, 100, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);

  const g = overlay.getContext('2d');
  if (!g) return { triangles };
  g.clearRect(0, 0, SIZE, SIZE);
  const px = (x: number) => ((x - minX) / span) * SIZE;
  const pz = (z: number) => ((z - minZ) / span) * SIZE;
  g.font = '13px sans-serif';
  for (let v = Math.ceil(minX); v <= minX + span; v += 1) {
    g.strokeStyle = v === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(px(v), 0);
    g.lineTo(px(v), SIZE);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(String(v), px(v) + 2, 14);
  }
  for (let v = Math.ceil(minZ); v <= minZ + span; v += 1) {
    g.strokeStyle = v === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(0, pz(v));
    g.lineTo(SIZE, pz(v));
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(String(v), 2, pz(v) - 2);
  }
  g.lineWidth = 3;
  for (const l of req.overlay.lines) {
    g.strokeStyle = l.color;
    g.beginPath();
    l.pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))));
    if (l.closed) g.closePath();
    g.stroke();
    const first = l.pts[0];
    if (l.label && first) {
      g.fillStyle = l.color;
      g.fillText(l.label, px(first[0]) + 6, pz(first[1]) - 6);
    }
  }
  for (const p of req.overlay.points) {
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(px(p.x), pz(p.z), p.r ?? 6, 0, Math.PI * 2);
    g.fill();
    g.fillText(p.label, px(p.x) + 8, pz(p.z) + 4);
  }
  return { triangles };
}

declare global {
  interface Window {
    planRender?: typeof render;
  }
}
window.planRender = render;
