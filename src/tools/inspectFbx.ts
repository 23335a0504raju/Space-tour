import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/**
 * Dev-only: inspects an FBX served by the Vite dev server (asset-pipeline skill: inspect before
 * integrating). Reports size, meshes, triangles, materials, referenced texture files, bones and
 * animation clips. Driven by scripts/inspect-fbx.ts.
 */
export interface FbxReport {
  size: [number, number, number];
  meshes: { name: string; triangles: number; skinned: boolean; materials: string[] }[];
  triangles: number;
  bones: number;
  boneNames: string[];
  clips: { name: string; duration: number; tracks: number }[];
  textures: string[];
}

async function inspectFbx(url: string): Promise<FbxReport> {
  const manager = new THREE.LoadingManager();
  const textures = new Set<string>();
  // record every texture path the FBX asks for, and don't fetch them (they may be missing)
  manager.setURLModifier((u) => {
    if (!u.toLowerCase().endsWith('.fbx')) {
      textures.add(decodeURIComponent(u.split('/').pop() ?? u));
      return 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    }
    return u;
  });
  const root = await new FBXLoader(manager).loadAsync(url);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const meshes: FbxReport['meshes'] = [];
  const bones = new Set<string>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.add(o.name);
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name);
    meshes.push({
      name: m.name,
      triangles: tris,
      skinned: (m as THREE.SkinnedMesh).isSkinnedMesh === true,
      materials: mats,
    });
  });
  return {
    size: [size.x, size.y, size.z],
    meshes,
    triangles: meshes.reduce((s, m) => s + m.triangles, 0),
    bones: bones.size,
    boneNames: [...bones].slice(0, 70),
    clips: root.animations.map((a) => ({
      name: a.name,
      duration: a.duration,
      tracks: a.tracks.length,
    })),
    textures: [...textures],
  };
}

declare global {
  interface Window {
    inspectFbx?: (url: string) => Promise<FbxReport>;
  }
}
window.inspectFbx = inspectFbx;
