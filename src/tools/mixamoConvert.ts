import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Dev-only: converts the Mixamo FBX downloads (raw-assets/mixamo/, served by the Vite dev server)
 * into one GLB with the character + all clips, using three.js's own FBXLoader and GLTFExporter
 * (no extra tool download). Driven by scripts/convert-mixamo.ts. Also reports per-clip data so
 * ambiguous clips (sitting/standing) can be identified from the hip-height trajectory.
 */
const BASE = '/raw-assets/mixamo/';
/** Clip name → file. Directions verified from hip height: standing 41→100 cm, sitting 98→61 cm. */
const CLIP_FILES: Record<string, string> = {
  typing: 'typing.fbx',
  sitIdle: 'sit-idle.fbx',
  idle: 'idle.fbx',
  walk: 'walk.fbx',
  standUp: 'standing.fbx',
  sitDown: 'sitting.fbx',
};

/** Clips whose horizontal root motion is removed (equivalent of Mixamo's "In Place"). */
const IN_PLACE = new Set(['walk']);

function pinHorizontalRootMotion(clip: THREE.AnimationClip): void {
  const hips = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
  if (!hips) return;
  const v = hips.values;
  const x0 = v[0] ?? 0;
  const z0 = v[2] ?? 0;
  for (let i = 0; i < v.length; i += 3) {
    v[i] = x0;
    v[i + 2] = z0;
  }
}

export interface ClipReport {
  duration: number;
  tracks: number;
  hipsYStart: number | null;
  hipsYEnd: number | null;
  hipsHorizontalTravel: number | null;
  hasSkin: boolean;
}

export interface ConversionResult {
  glbBase64: string;
  clips: Record<string, ClipReport>;
  meshes: Array<{ name: string; triangles: number; material: string; skinned: boolean }>;
  bones: number;
  boneNames: string[];
  heightCm: number;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function convert(): Promise<ConversionResult> {
  const loader = new FBXLoader();
  const character = await loader.loadAsync(`${BASE}character.fbx`);

  const meshes: ConversionResult['meshes'] = [];
  const boneNames: string[] = [];
  character.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh) {
      const g = m.geometry;
      const tris = (g.index ? g.index.count : (g.attributes['position']?.count ?? 0)) / 3;
      const mat = Array.isArray(m.material)
        ? m.material.map((x) => x.name).join('+')
        : m.material.name;
      meshes.push({
        name: m.name,
        triangles: tris,
        material: mat,
        skinned: Boolean(m.isSkinnedMesh),
      });
    }
    if ((o as THREE.Bone).isBone) boneNames.push(o.name);
  });
  const box = new THREE.Box3().setFromObject(character);

  const clips: THREE.AnimationClip[] = [];
  const report: Record<string, ClipReport> = {};
  for (const [name, file] of Object.entries(CLIP_FILES)) {
    const group = await loader.loadAsync(`${BASE}${file}`);
    const clip = group.animations[0];
    if (!clip) throw new Error(`${file}: no animation`);
    clip.name = name;
    let hasSkin = false;
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) hasSkin = true;
    });
    const hips = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
    const v = hips?.values;
    const n = v ? v.length : 0;
    report[name] = {
      duration: clip.duration,
      tracks: clip.tracks.length,
      hipsYStart: v ? (v[1] ?? null) : null,
      hipsYEnd: v ? (v[n - 2] ?? null) : null,
      hipsHorizontalTravel: v
        ? Math.hypot((v[n - 3] ?? 0) - (v[0] ?? 0), (v[n - 1] ?? 0) - (v[2] ?? 0))
        : null,
      hasSkin,
    };
    if (clip.tracks.length === 0 || clip.duration === 0) continue; // empty download: skip, reported
    if (IN_PLACE.has(name)) pinHorizontalRootMotion(clip);
    clips.push(clip);
  }

  // Mixamo FBX is in centimetres: scale the root so the glTF is in metres (1 unit = 1 m).
  character.animations = [];
  const root = new THREE.Group();
  root.name = 'Astronaut';
  character.scale.setScalar(0.01);
  root.add(character);

  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(root, {
    binary: true,
    animations: clips,
    onlyVisible: true,
  })) as ArrayBuffer;

  return {
    glbBase64: toBase64(glb),
    clips: report,
    meshes,
    bones: boneNames.length,
    boneNames,
    heightCm: box.max.y - box.min.y,
  };
}

declare global {
  interface Window {
    convertMixamo?: () => Promise<ConversionResult>;
  }
}
window.convertMixamo = convert;
