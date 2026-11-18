import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Dev-only model preview for asset review: renders a GLB from a given angle under neutral studio
 * light, flat-shaded (for meshes without normals). Driven by scripts/preview-model.ts.
 */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 720);
renderer.toneMapping = THREE.AgXToneMapping;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1e24');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(3, 5, 4);
scene.add(sun, new THREE.HemisphereLight('#bcc8e0', '#25221f', 0.6));
const camera = new THREE.PerspectiveCamera(35, 1280 / 720, 0.01, 10000);
let model: THREE.Object3D | null = null;
let radius = 1;

async function load(url: string) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  model = gltf.scene;
  const materials = new Set<string>();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) {
      materials.add(`${mat.name} ${(mat as THREE.MeshStandardMaterial).color?.getHexString()}`);
      (mat as THREE.MeshStandardMaterial).flatShading = true;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  radius = box.getSize(new THREE.Vector3()).length() / 2;
  scene.add(model);
  return { size: box.getSize(new THREE.Vector3()).toArray(), materials: [...materials] };
}

function view(azimuthDeg: number, elevationDeg: number, zoom = 1) {
  const a = THREE.MathUtils.degToRad(azimuthDeg);
  const e = THREE.MathUtils.degToRad(elevationDeg);
  const d = (radius * 2.4) / zoom;
  camera.position.set(
    Math.sin(a) * Math.cos(e) * d,
    Math.sin(e) * d,
    Math.cos(a) * Math.cos(e) * d,
  );
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

export type PreviewInfo = Awaited<ReturnType<typeof load>>;

declare global {
  interface Window {
    previewLoad?: typeof load;
    previewView?: typeof view;
  }
}
window.previewLoad = load;
window.previewView = view;
