import * as THREE from 'three';

/**
 * Uploads a hidden chapter's vertex and index buffers while it waits in the warm window.
 *
 * `compile`/`compileAsync` prepare materials only; three uploads an object's geometry on its first
 * real draw. SC11c's first visible frame queued every buffer of the anime worlds, and the first
 * synchronous GL query after them (getProgramParameter) waited for the GPU process to swallow the
 * lot: 125–211 ms at entry with no program linked (scripts/measure-freezes.ts --why: "shader ms"
 * with "0 programs linked", LoAF mostly render).
 *
 * The group is drawn once into a 1×1 target with frustum culling off and one plain override
 * material, so every visible object's buffers upload, and none of the chapter's real program
 * variants is created (the override's few programs compile once and are reused). Synchronous: the
 * group, its culling flags and its parent are restored before anyone else sees them. Objects a
 * chapter keeps hidden (reveals) are skipped, as a draw would skip them.
 */
const stage = new THREE.Scene();
stage.overrideMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });

export function uploadGeometry(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  group: THREE.Group,
): void {
  const parent = group.parent;
  if (!parent) return;
  const index = parent.children.indexOf(group);
  const culled: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
  });
  const wasVisible = group.visible;
  const previous = gl.getRenderTarget();
  const shadowAuto = gl.shadowMap.autoUpdate;
  const shadowNeeds = gl.shadowMap.needsUpdate;
  const autoReset = gl.info.autoReset;
  // no shadow pass (it would draw with the chapter's depth programs); keep the frame's stats
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = false;
  gl.info.autoReset = false;
  stage.add(group); // removes it from its parent for the duration
  group.visible = true;
  try {
    gl.setRenderTarget(target);
    gl.render(stage, camera);
  } finally {
    group.visible = wasVisible;
    stage.remove(group);
    // back in the same slot (draw order of the parent's children is unchanged)
    parent.children.splice(index, 0, group);
    group.parent = parent;
    for (const o of culled) o.frustumCulled = true;
    gl.setRenderTarget(previous);
    gl.shadowMap.autoUpdate = shadowAuto;
    gl.shadowMap.needsUpdate = shadowNeeds;
    gl.info.autoReset = autoReset;
  }
}
