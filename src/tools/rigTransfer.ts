import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Dev-only: puts an unrigged character mesh (the "player" astronaut suit, A039) on the Mixamo Y Bot
 * skeleton, so every existing clip (typing, stand up, walk, sit) drives it unchanged.
 *  1. The suit is scaled and placed over the Y Bot (feet on the floor, centred on the hips).
 *  2. The Y Bot's upper arms are lowered from its T-pose to the suit's A-pose angle, measured from
 *     the suit's outermost (hand) vertices.
 *  3. Every suit vertex takes the skin weights of the nearest posed Y Bot vertex (body + joints).
 *  4. The suit meshes are bound to the skeleton in that pose; the Y Bot meshes are removed.
 * Driven by scripts/rig-transfer.ts. Output: the Y Bot armature + clips with the suit as its skin.
 */
export interface RigTransferResult {
  glbBase64: string;
  byteLength: number;
  triangles: number;
  armAngleDeg: number;
  scale: number;
  maxMatchCm: number;
  meanMatchCm: number;
}

const load = (url: string) => new GLTFLoader().loadAsync(url);

function worldBox(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

/** Rotate `bone` about a world-space axis, keeping its parent. */
function rotateWorld(bone: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.updateMatrixWorld(true);
  const pq = parent.getWorldQuaternion(new THREE.Quaternion());
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const turned = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(wq);
  bone.quaternion.copy(pq.invert().multiply(turned));
  bone.updateMatrixWorld(true);
}

async function rigTransfer(botUrl: string, suitUrl: string): Promise<RigTransferResult> {
  const bot = await load(botUrl);
  const suit = await load(suitUrl);
  const scene = bot.scene;
  scene.updateMatrixWorld(true);

  const skinned: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });
  const first = skinned[0];
  if (!first) throw new Error('rigTransfer: Y Bot has no skinned mesh');
  const skeleton = first.skeleton;
  const bone = (n: string) => {
    const b = scene.getObjectByName(`mixamorig${n}`);
    if (!b) throw new Error(`rigTransfer: bone ${n} missing`);
    return b;
  };

  // ── 1 · scale and place the suit over the bot ───────────────────────────────
  const botBox = worldBox(scene);
  const hips = bone('Hips').getWorldPosition(new THREE.Vector3());
  const lShoulder = bone('LeftArm').getWorldPosition(new THREE.Vector3());
  const rShoulder = bone('RightArm').getWorldPosition(new THREE.Vector3());
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;

  const suitRoot = suit.scene;
  const suitBox0 = worldBox(suitRoot);
  // match shoulder height: the suit's shoulders sit ~ where its width is greatest below the helmet;
  // measured robustly as 0.80 of the suit's height (helmet included), the bot's is shoulderY.
  const suitH = suitBox0.max.y - suitBox0.min.y;
  const scale = shoulderY / (0.8 * suitH);
  const holder = new THREE.Group();
  holder.add(suitRoot);
  suitRoot.scale.multiplyScalar(scale);
  holder.updateMatrixWorld(true);
  const b1 = worldBox(holder);
  suitRoot.position.x += hips.x - (b1.min.x + b1.max.x) / 2;
  suitRoot.position.z += hips.z - (b1.min.z + b1.max.z) / 2;
  suitRoot.position.y += botBox.min.y - b1.min.y;
  holder.updateMatrixWorld(true);

  // bake suit meshes into world-space geometry
  const parts: {
    geo: THREE.BufferGeometry;
    mat: THREE.Material | THREE.Material[];
    name: string;
  }[] = [];
  suitRoot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    parts.push({ geo: g, mat: m.material, name: m.name });
  });
  // ── 2 · lower the bot's arms to the suit's A-pose ───────────────────────────
  let tipL: THREE.Vector3 | null = null;
  let tipR: THREE.Vector3 | null = null;
  const p = new THREE.Vector3();
  for (const { geo } of parts) {
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      p.fromBufferAttribute(pos, i);
      if (!tipL || p.x > tipL.x) tipL = p.clone();
      if (!tipR || p.x < tipR.x) tipR = p.clone();
    }
  }
  if (!tipL || !tipR) throw new Error('rigTransfer: empty suit');
  // the bot's left arm points to +x in its T-pose (checked against the bones)
  const lSide = lShoulder.x > hips.x ? 1 : -1;
  const tipFor = (side: number) => (side * lSide > 0 ? tipL : tipR) as THREE.Vector3;
  const angleOf = (s: THREE.Vector3, tip: THREE.Vector3) =>
    Math.atan2(s.y - tip.y, Math.abs(tip.x - s.x));
  const aL = angleOf(lShoulder, tipFor(1));
  const aR = angleOf(rShoulder, tipFor(-1));
  const z = new THREE.Vector3(0, 0, 1);
  rotateWorld(bone('LeftArm'), z, -lSide * aL);
  rotateWorld(bone('RightArm'), z, lSide * aR);
  scene.updateMatrixWorld(true);

  // ── 3 · nearest posed bot vertex → skin weights ─────────────────────────────
  const srcPos: number[] = [];
  const srcIdx: number[] = [];
  const srcW: number[] = [];
  const v = new THREE.Vector3();
  for (const sm of skinned) {
    const pos = sm.geometry.getAttribute('position');
    const si = sm.geometry.getAttribute('skinIndex');
    const sw = sm.geometry.getAttribute('skinWeight');
    // map this mesh's skin indices to the shared skeleton's bone order
    const map = sm.skeleton.bones.map((b) => skeleton.bones.indexOf(b));
    for (let i = 0; i < pos.count; i += 1) {
      sm.getVertexPosition(i, v);
      v.applyMatrix4(sm.matrixWorld);
      srcPos.push(v.x, v.y, v.z);
      for (let k = 0; k < 4; k += 1) {
        srcIdx.push(Math.max(0, map[si.getComponent(i, k)] ?? 0));
        srcW.push(sw.getComponent(i, k));
      }
    }
  }
  const CELL = 0.05;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, zz: number) =>
    `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(zz / CELL)}`;
  for (let i = 0; i < srcPos.length / 3; i += 1) {
    const k = key(srcPos[i * 3]!, srcPos[i * 3 + 1]!, srcPos[i * 3 + 2]!);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  const nearest = (x: number, y: number, zz: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const cz = Math.floor(zz / CELL);
    for (let r = 0; r < 40; r += 1) {
      let best = -1;
      let bestD = Infinity;
      for (let dx = -r; dx <= r; dx += 1)
        for (let dy = -r; dy <= r; dy += 1)
          for (let dz = -r; dz <= r; dz += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
            const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!list) continue;
            for (const j of list) {
              const d =
                (srcPos[j * 3]! - x) ** 2 +
                (srcPos[j * 3 + 1]! - y) ** 2 +
                (srcPos[j * 3 + 2]! - zz) ** 2;
              if (d < bestD) {
                bestD = d;
                best = j;
              }
            }
          }
      // a hit in ring r is only certain once ring r+1 cannot be closer
      if (best >= 0 && Math.sqrt(bestD) <= r * CELL) return { j: best, d: Math.sqrt(bestD) };
      if (best >= 0 && r > 0) return { j: best, d: Math.sqrt(bestD) };
    }
    return { j: 0, d: Infinity };
  };
  // ── 4 · bind the suit to the skeleton in this pose ──────────────────────────
  // rigid parts: the helmet follows the head and the backpack the upper spine. Nearest-vertex
  // weights tore them (backpack points matched the shoulders and arms when seated).
  const boneIndex = (n: string) => skeleton.bones.indexOf(bone(n) as THREE.Bone);
  const HEAD = boneIndex('Head');
  const SPINE = boneIndex('Spine2');
  const neckY = bone('Neck').getWorldPosition(new THREE.Vector3()).y;
  const rigid = (x: number, y: number, zz: number): number => {
    if (y > neckY + 0.03 && Math.abs(x - hips.x) < 0.3) return HEAD;
    if (zz < hips.z - 0.09 && y > hips.y - 0.05 && y < neckY + 0.25 && Math.abs(x - hips.x) < 0.42)
      return SPINE;
    return -1;
  };
  for (const sm of skinned) sm.removeFromParent();
  const bound = new THREE.Skeleton(skeleton.bones);
  bound.calculateInverses();
  let triangles = 0;
  let maxD = 0;
  let sumD = 0;
  let n = 0;
  for (const { geo, mat, name } of parts) {
    const pos = geo.getAttribute('position');
    const idx = new Uint16Array(pos.count * 4);
    const w = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i += 1) {
      const r = rigid(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (r >= 0) {
        idx.set([r, 0, 0, 0], i * 4);
        w.set([1, 0, 0, 0], i * 4);
        continue;
      }
      const { j, d } = nearest(pos.getX(i), pos.getY(i), pos.getZ(i));
      maxD = Math.max(maxD, d);
      sumD += d;
      n += 1;
      for (let k = 0; k < 4; k += 1) {
        idx[i * 4 + k] = srcIdx[j * 4 + k]!;
        w[i * 4 + k] = srcW[j * 4 + k]!;
      }
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.name = `Suit_${name}`;
    scene.add(mesh);
    mesh.bind(bound, new THREE.Matrix4());
    triangles += (geo.index ? geo.index.count : pos.count) / 3;
  }
  scene.updateMatrixWorld(true);

  const glb = (await new GLTFExporter().parseAsync(scene, {
    binary: true,
    animations: bot.animations,
  })) as ArrayBuffer;
  // large output: the driver reads it back in chunks (window.rigChunk)
  window.rigBytes = new Uint8Array(glb);
  return {
    glbBase64: '',
    byteLength: glb.byteLength,
    triangles,
    armAngleDeg: THREE.MathUtils.radToDeg((aL + aR) / 2),
    scale,
    maxMatchCm: maxD * 100,
    meanMatchCm: (sumD / Math.max(1, n)) * 100,
  };
}

declare global {
  interface Window {
    rigTransfer?: (bot: string, suit: string) => Promise<RigTransferResult>;
    rigBytes?: Uint8Array;
    rigChunk?: (from: number, to: number) => string;
  }
}
window.rigTransfer = rigTransfer;
window.rigChunk = (from, to) => {
  const bytes = window.rigBytes?.subarray(from, to) ?? new Uint8Array();
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
