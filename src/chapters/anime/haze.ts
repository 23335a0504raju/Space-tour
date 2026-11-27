import * as THREE from 'three';

/**
 * Distance haze for the SC11 worlds: every surface fades into the live sky colour behind it
 * between `near` and `far` metres from the camera, so the ground runs out to the painted sky with
 * no edge. Chapters may not set `scene.fog` (neighbouring chapters are mounted at the same time),
 * so the haze is a material patch with uniforms owned by one world.
 */
export interface Haze {
  /** the horizon colour (the cloud sea fades into it) */
  readonly color: { value: THREE.Color };
  /** the sky dome's four gradient stops: hazed surfaces take the sky colour behind them */
  readonly sky: { value: THREE.Color[] };
  readonly near: { value: number };
  readonly far: { value: number };
}

export const createHaze = (near: number, far: number): Haze => ({
  color: { value: new THREE.Color() },
  sky: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
  near: { value: near },
  far: { value: far },
});

const VERT_DECL = 'varying vec3 vHazePos;\n';
// The sky dome's gradient (parts.tsx SkyDome), sampled along the view ray in world space, so a
// fully hazed surface is exactly the sky behind it: no inked line where the ground meets the sky.
const FRAG_DECL = /* glsl */ `
uniform vec3 uHazeSky[4];
uniform float uHazeNear;
uniform float uHazeFar;
varying vec3 vHazePos;
vec3 hazeSky() {
  vec3 d = normalize((vec4(vHazePos, 0.0) * viewMatrix).xyz);
  float h = clamp(d.y * 1.4 + 0.15, 0.0, 1.0);
  return h < 0.33 ? mix(uHazeSky[0], uHazeSky[1], h / 0.33)
       : h < 0.66 ? mix(uHazeSky[1], uHazeSky[2], (h - 0.33) / 0.33)
       : mix(uHazeSky[2], uHazeSky[3], (h - 0.66) / 0.34);
}
`;

/**
 * An opaque surface lost wholly in the haze also marks itself as painted (alpha 0.5, as
 * parts.tsx PAINTED_BLEND): the style pass then treats it exactly like the sky behind it, instead
 * of posterising it into a grey band along the horizon.
 */
const FRAG_BODY = /* glsl */ `#include <dithering_fragment>
  {
    float lost = smoothstep(uHazeNear, uHazeFar, length(vHazePos));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(), lost);
#ifdef HAZE_MARK
    gl_FragColor.a = mix(gl_FragColor.a, 0.5, smoothstep(0.85, 1.0, lost));
#endif
  }`;

/** Only a plain opaque material may write its own alpha (others blend with it). */
const marks = (mat: THREE.Material) => !mat.transparent && mat.blending === THREE.NormalBlending;

/** Patch a built-in material (standard, lambert, basic) in place. */
export function applyHaze<M extends THREE.Material>(mat: M, haze: Haze): M {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms['uHazeSky'] = haze.sky;
    shader.uniforms['uHazeNear'] = haze.near;
    shader.uniforms['uHazeFar'] = haze.far;
    shader.vertexShader =
      VERT_DECL +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        // interpolate the view-space position, not its length: a big ground triangle's corners are
        // kilometres away, and an interpolated distance would haze all of it
        '#include <project_vertex>\n  vHazePos = mvPosition.xyz;',
      );
    shader.fragmentShader =
      (marks(mat) ? '#define HAZE_MARK\n' : '') +
      FRAG_DECL +
      shader.fragmentShader.replace('#include <dithering_fragment>', FRAG_BODY);
  };
  mat.customProgramCacheKey = () => (marks(mat) ? 'sc11-haze-mark' : 'sc11-haze');
  mat.needsUpdate = true;
  return mat;
}

/** Per-haze cache of patched clones, so every copy of a model shares one material per source. */
const clones = new WeakMap<Haze, WeakMap<THREE.Material, THREE.Material>>();
export function hazed(src: THREE.Material, haze: Haze): THREE.Material {
  let map = clones.get(haze);
  if (!map) clones.set(haze, (map = new WeakMap()));
  let m = map.get(src);
  if (!m) map.set(src, (m = applyHaze(src.clone(), haze)));
  return m;
}

/** The sky dome's horizon colour for four gradient stops (matches SkyDome's h = 0.15 sample). */
export function horizonColor(stops: readonly THREE.Color[], out: THREE.Color): THREE.Color {
  return out.copy(stops[0]!).lerp(stops[1]!, 0.15 / 0.33);
}
