import * as THREE from 'three';

/**
 * Chapter warm-up (scroll fix, 2026-11-22). A chapter's first visible frame used to compile and
 * link every shader synchronously: the profile showed 6.6 s inside getProgramInfoLog while
 * scrolling the first chapters, with single freezes of up to 7.9 s.
 *
 *  - compileChapter: compiles one chapter's materials off the main thread
 *    (KHR_parallel_shader_compile via compileAsync) with the same lights as when it is on screen,
 *    and uploads its textures.
 *  - pinPrograms: keeps every compiled program alive after its chapter unmounts, so a chapter that
 *    comes back reuses its programs instead of compiling them again. Programs are small (driver
 *    objects); textures and geometry are still freed as before.
 */

const pinned = new WeakSet<object>();

interface ProgramLike {
  usedTimes: number;
}

/** Keep every program compiled so far: three.js destroys a program when usedTimes reaches 0. */
export function pinPrograms(gl: THREE.WebGLRenderer): void {
  const programs = gl.info.programs as unknown as ProgramLike[] | null;
  for (const p of programs ?? []) {
    if (pinned.has(p)) continue;
    pinned.add(p);
    p.usedTimes += 1;
  }
}

/** Upload every texture the group's materials use (otherwise uploaded on the first frame). */
export function uploadTextures(gl: THREE.WebGLRenderer, root: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const v of Object.values(m)) {
        if ((v as THREE.Texture | null)?.isTexture) seen.add(v as THREE.Texture);
      }
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          if ((u?.value as THREE.Texture | null)?.isTexture) seen.add(u.value as THREE.Texture);
        }
      }
    }
  });
  for (const t of seen) {
    // render-target textures and textures without data are set up by the renderer itself
    if ((t as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) continue;
    if (!t.image && !(t as THREE.CompressedTexture).mipmaps?.length) continue;
    gl.initTexture(t);
  }
}

/**
 * Compile one chapter's group as it will be drawn: only that chapter visible (lights are part of
 * a program's key), then restore the visibility the Director set. Resolves when every program
 * has linked.
 */
export async function compileChapter(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  group: THREE.Group,
  groups: ReadonlyMap<string, THREE.Group>,
  target: THREE.WebGLRenderTarget | null,
): Promise<void> {
  // the output encoding and tone mapping are part of a program: compile for the real target
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const saved = new Map<THREE.Group, boolean>();
  for (const g of groups.values()) {
    saved.set(g, g.visible);
    g.visible = g === group;
  }
  group.visible = true;
  let pending: Promise<unknown>;
  try {
    // the synchronous part (program creation, light gathering) happens inside this call
    pending = gl.compileAsync(group, camera, scene);
  } finally {
    for (const [g, v] of saved) g.visible = v;
    if (!saved.has(group)) group.visible = false;
    gl.setRenderTarget(previous);
  }
  await pending.catch(() => undefined);
  uploadTextures(gl, group);
  const before = gl.getRenderTarget();
  gl.setRenderTarget(target);
  try {
    keepShaders(gl, camera, scene, group, groups);
  } finally {
    gl.setRenderTarget(before);
  }
  pinPrograms(gl);
}

/** Materials already kept, by their shader source pair (one keeper per distinct program). */
const kept = new Set<string>();
const keepers: THREE.Object3D[] = [];

/**
 * three.js numbers each custom shader source while some material uses it, and that number is
 * part of the program key. When a chapter unmounts, its materials are disposed, the numbers are
 * freed, and the same shaders get new numbers (new keys, a full recompile) when it comes back:
 * 164 byte-identical shaders were recompiled mid-scroll. A keeper (a clone of the object with a
 * clone of its material, never disposed and never drawn) holds each shader's number and program.
 */
function keepShaders(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  group: THREE.Group,
  groups: ReadonlyMap<string, THREE.Group>,
): void {
  const fresh: THREE.Object3D[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material || Array.isArray(material)) return;
    const shader = material as THREE.ShaderMaterial;
    const key = `${material.type}|${mesh.type}|${shader.vertexShader ?? ''}|${shader.fragmentShader ?? ''}|${JSON.stringify(shader.defines ?? {})}`;
    if (kept.has(key)) return;
    kept.add(key);
    const keeper = mesh.clone(false) as THREE.Mesh;
    keeper.material = material.clone();
    keeper.matrixAutoUpdate = false;
    fresh.push(keeper);
  });
  if (!fresh.length) return;
  // same lights as the chapter on screen: only this chapter's group visible
  const holder = new THREE.Group();
  for (const k of fresh) holder.add(k);
  group.add(holder);
  const saved = new Map<THREE.Group, boolean>();
  for (const g of groups.values()) {
    saved.set(g, g.visible);
    g.visible = g === group;
  }
  try {
    gl.compile(holder, camera, scene);
  } finally {
    for (const [g, v] of saved) g.visible = v;
    group.remove(holder);
  }
  keepers.push(...fresh);
}
