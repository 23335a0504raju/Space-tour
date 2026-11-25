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
 * An empty stand-in for the real scene while a chapter compiles. `compile(object, camera, scene)`
 * gathers lights from `scene` AND from `object`, so compiling a chapter's group against the real
 * scene counted its own lights twice (NUM_DIR_LIGHTS 2 for a one-sun chapter): every lit program
 * compiled while warm was a variant the chapter never draws, and they all linked again on its
 * first visible frame (scripts/measure-freezes.ts --dump). The stand-in has no children, so the
 * lights come from the chapter alone, and it carries the environment the Director applies when
 * the chapter is on screen (the environment is part of the program key, too).
 */
const stage = new THREE.Scene();

/**
 * Where a chapter may be drawn. The output is part of every program key (three 0.187
 * WebGLPrograms): drawing to the screen bakes in `renderer.toneMapping` and the output colour space;
 * drawing into ANY render target means no tone mapping and linear output. So one stand-in target
 * covers every "into the post chain" case.
 */
export interface Output {
  readonly target: THREE.WebGLRenderTarget | null;
  readonly toneMapping: THREE.ToneMapping;
}

const intoPost = new THREE.WebGLRenderTarget(1, 1);
/** Drawn into the post chain's input buffer (the composer owns tone mapping). */
export const POST_OUTPUT: Output = { target: intoPost, toneMapping: THREE.NoToneMapping };
/** Drawn straight to the canvas, the renderer applying AgX itself (Low without post). */
export const SCREEN_OUTPUT: Output = { target: null, toneMapping: THREE.AgXToneMapping };

/**
 * Compile one chapter's group as it will be drawn (its own lights and environment) for each
 * output it may be drawn to, with keepers for its custom shaders, then upload its textures.
 * Resolves when every program has linked.
 */
export async function compileChapter(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  group: THREE.Group,
  environment: THREE.Texture | null,
  outputs: readonly Output[],
): Promise<void> {
  const holder = makeKeepers(group);
  const previous = gl.getRenderTarget();
  const previousToneMapping = gl.toneMapping;
  const wasVisible = group.visible;
  // lights are gathered with traverseVisible: the group itself must count as visible
  group.visible = true;
  stage.environment = environment;
  if (holder) group.add(holder);
  const pending: Promise<unknown>[] = [];
  try {
    for (const output of outputs) {
      gl.setRenderTarget(output.target);
      gl.toneMapping = output.toneMapping;
      // the synchronous part (program creation, light gathering) happens inside this call
      pending.push(gl.compileAsync(group, camera, stage).catch(() => undefined));
    }
  } finally {
    if (holder) group.remove(holder);
    stage.environment = null;
    group.visible = wasVisible;
    gl.toneMapping = previousToneMapping;
    gl.setRenderTarget(previous);
  }
  await Promise.all(pending);
  uploadTextures(gl, group);
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
 * Returns a holder of the new keepers (compiled with the chapter, same lights), or null.
 */
function makeKeepers(group: THREE.Group): THREE.Group | null {
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
  if (!fresh.length) return null;
  keepers.push(...fresh);
  const holder = new THREE.Group();
  for (const k of fresh) holder.add(k);
  return holder;
}
