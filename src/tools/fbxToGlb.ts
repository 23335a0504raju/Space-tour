import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Dev-only: converts one FBX (served by the Vite dev server) to a binary glTF with three.js's own
 * FBXLoader + GLTFExporter. Texture references that can't be resolved are replaced by nothing
 * (materials keep their colours); textures are assigned later in the optimisation step.
 * Driven by scripts/convert-fbx.ts.
 */
export interface FbxConversion {
  glbBase64: string;
  triangles: number;
  meshes: number;
  materials: string[];
}

async function fbxToGlb(url: string): Promise<FbxConversion> {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) =>
    u.toLowerCase().endsWith('.fbx') ? u : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
  );
  const root = await new FBXLoader(manager).loadAsync(url);
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes += 1;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const list = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of list) {
      materials.add(mat.name);
      // drop the 1×1 placeholder maps: they would be exported as real textures
      const std = mat as THREE.MeshPhongMaterial;
      for (const key of ['map', 'normalMap', 'specularMap', 'bumpMap', 'emissiveMap'] as const)
        if (std[key]) std[key] = null;
    }
  });
  const glb = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer;
  let bin = '';
  const bytes = new Uint8Array(glb);
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { glbBase64: btoa(bin), triangles, meshes, materials: [...materials] };
}

declare global {
  interface Window {
    fbxToGlb?: (url: string) => Promise<FbxConversion>;
  }
}
window.fbxToGlb = fbxToGlb;
