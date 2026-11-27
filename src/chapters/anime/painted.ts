import * as THREE from 'three';
import { applyHaze } from './haze.ts';
import type { Haze } from './haze.ts';
import { PAINTED_BLEND } from './parts.tsx';

/**
 * The painted frontier town of SC11-B (Raju, 2026-11-25: the town read purple-pink over a flat
 * orange street). Its models get a self-lit painted material in place of the chapter's light rig:
 * two-tone cel light with cool shadows, plank seams on walls, shingle rows on roofs, and a dirt
 * street with wheel ruts. Normals come from screen derivatives (the SketchUp export has unreliable
 * ones). Painted surfaces mark the alpha channel (PAINTED_BLEND), so the style pass adds no ink and
 * no posterising. Static: the only moving value is `drop`, the world's rise and fall (anime.ts
 * presence), which keeps the painted detail fixed to the buildings.
 */
export interface Paint {
  /** the world group's current y offset (chapter frame) */
  readonly drop: { value: number };
  /** the street level in the chapter frame */
  readonly ground: { value: number };
  /** direction towards the sun, world space */
  readonly sun: { value: THREE.Vector3 };
}

export const createPaint = (ground: number, sun: THREE.Vector3): Paint => ({
  drop: { value: 0 },
  ground: { value: ground },
  sun: { value: sun.clone().normalize() },
});

/** The street's dirt: one colour for the town's terrain, the desert floor and the road beyond. */
const DIRT = new THREE.Color('#b97844');

const VERT_DECL = 'varying vec3 vPaintPos;\n';
const VERT_BODY = /* glsl */ `#include <project_vertex>
  {
    vec4 pw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      pw = instanceMatrix * pw;
    #endif
    vPaintPos = (modelMatrix * pw).xyz;
  }`;

const FRAG_DECL = /* glsl */ `
uniform float uDrop;
uniform float uGround;
uniform vec3 uSunDir;
uniform vec3 uDirt;
varying vec3 vPaintPos;
float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(pHash(i), pHash(i + vec2(1, 0)), f.x), mix(pHash(i + vec2(0, 1)), pHash(i + vec2(1, 1)), f.x), f.y);
}
`;

const FRAG_BODY = /* glsl */ `#include <color_fragment>
  {
    vec3 p = vPaintPos - vec3(0.0, uDrop, 0.0);
    vec3 n = normalize(cross(dFdx(vPaintPos), dFdy(vPaintPos)));
    float h = p.y - uGround;
    // fine detail fades with distance (it would only shimmer)
    float near = 1.0 - smoothstep(140.0, 360.0, distance(cameraPosition, vPaintPos));
    float flatUp = step(0.75, n.y);
#ifdef PAINT_GROUND
    float soil = 1.0;
#else
    float soil = flatUp * (1.0 - step(1.3, h));
#endif
    vec3 col = diffuseColor.rgb;
    if (soil > 0.5) {
      // broad brush patches of lighter and darker earth
      float broad = pNoise(p.xz * 0.06) * 0.65 + pNoise(p.xz * 0.19 + 7.0) * 0.35;
      col = uDirt * mix(0.8, 1.16, smoothstep(0.25, 0.75, broad));
      // two pairs of wagon ruts wandering down the street
      float x = p.x + (pNoise(vec2(p.z * 0.035, 3.0)) - 0.5) * 3.0;
      float ax = abs(x);
      float rut = max(1.0 - smoothstep(0.35, 0.75, abs(ax - 4.0)), 1.0 - smoothstep(0.35, 0.75, abs(ax - 9.5)));
      rut *= 0.65 + 0.35 * pNoise(vec2(ax * 2.0, p.z * 0.4));
      col *= 1.0 - 0.3 * rut * (1.0 - step(16.0, ax));
      // the trodden middle is paler
      col *= 1.0 + 0.1 * (1.0 - smoothstep(0.0, 3.0, ax));
      // pebbles
      vec2 cell = floor(p.xz / 0.8);
      float stone = step(0.93, pHash(cell)) * (1.0 - smoothstep(0.1, 0.22, length(fract(p.xz / 0.8) - 0.5)));
      col = mix(col, uDirt * 0.62, stone * near);
    } else {
      if (abs(n.y) < 0.55) {
        // plank seams and a different tone for every board
        vec2 tangent = normalize(vec2(-n.z, n.x));
        float u = dot(p.xz, tangent) / 1.15;
        float seam = 1.0 - smoothstep(0.04, 0.1, min(fract(u), 1.0 - fract(u)));
        float board = pHash(vec2(floor(u), floor(dot(p.xz, n.xz) * 0.5))) - 0.5;
        col *= 1.0 + (board * 0.12 - seam * 0.2) * near;
        // sun-bleached high up, dusty and shaded at the foot
        col *= 0.92 + 0.14 * smoothstep(2.0, 24.0, h);
        col = mix(col, uDirt * 0.75, (1.0 - smoothstep(0.0, 4.0, h)) * 0.4);
      } else {
        // shingle and porch rows
        float row = fract((p.y * 1.6 + (p.x + p.z) * 0.35) / 0.9);
        col *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.2, row)) * near;
      }
    }
    // two-tone painted light: warm where the sun reaches, a cool soft shadow elsewhere
    vec3 facing = dot(n, cameraPosition - vPaintPos) < 0.0 ? -n : n;
    float d = dot(facing, uSunDir);
    float lit = smoothstep(0.02, 0.2, d);
    // richer than the palette: tone mapping and the style pass's lift both pale painted colours
    col = max(mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.22), 0.0);
    vec3 shade = col * vec3(0.34, 0.31, 0.47) + vec3(0.008, 0.007, 0.024);
    vec3 sunlit = col * vec3(0.9, 0.82, 0.72) * (1.0 + 0.18 * smoothstep(0.55, 0.9, d));
    diffuseColor.rgb = mix(shade, sunlit, soil > 0.5 ? 1.0 : lit);
  }`;

/** Patch a basic material into a painted one (haze included). */
function paintMaterial(
  mat: THREE.MeshBasicMaterial,
  haze: Haze,
  paint: Paint,
  kind: 'wood' | 'ground' | 'atlas',
): THREE.MeshBasicMaterial {
  applyHaze(mat, haze);
  const hazeCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    hazeCompile.call(mat, shader, renderer);
    shader.uniforms['uDrop'] = paint.drop;
    shader.uniforms['uGround'] = paint.ground;
    shader.uniforms['uSunDir'] = paint.sun;
    shader.uniforms['uDirt'] = { value: DIRT };
    shader.vertexShader =
      VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader =
      (kind === 'ground' ? '#define PAINT_GROUND\n' : '') +
      FRAG_DECL +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        kind === 'atlas' ? ATLAS_BODY : FRAG_BODY,
      );
  };
  mat.customProgramCacheKey = () => `sc11-painted-${kind}`;
  // painted-surface mark, kept in the opaque pass (these are solid walls)
  Object.assign(mat, { ...PAINTED_BLEND, transparent: false });
  return mat;
}

/** The painted dirt floor (street and desert). */
export const paintedGround = (haze: Haze, paint: Paint): THREE.MeshBasicMaterial =>
  paintMaterial(
    new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -1 }),
    haze,
    paint,
    'ground',
  );

const ATLAS_BODY = /* glsl */ `#include <color_fragment>
  {
    vec3 p = vPaintPos - vec3(0.0, uDrop, 0.0);
    vec3 n = normalize(cross(dFdx(vPaintPos), dFdy(vPaintPos)));
    vec3 facing = dot(n, cameraPosition - vPaintPos) < 0.0 ? -n : n;
    vec3 col = diffuseColor.rgb;
    // anime colour: richer than the photo sheet, greens and roofs most
    col = max(mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.3), 0.0);
    // two-tone painted light: warm where the sun reaches, a cool soft shadow elsewhere
    float d = dot(facing, uSunDir);
    float lit = smoothstep(-0.02, 0.22, d);
    vec3 shade = col * vec3(0.5, 0.5, 0.74) + vec3(0.008, 0.01, 0.03);
    vec3 sunlit = col * vec3(1.16, 1.06, 0.9);
    col = mix(shade, sunlit, lit);
    // walls and cliffs: darker at the foot, bleached towards the top
    float h = p.y - uGround;
    float wall = 1.0 - smoothstep(0.45, 0.75, abs(n.y));
    col *= mix(1.0, 0.8 + 0.3 * smoothstep(0.0, 60.0, h), wall);
    diffuseColor.rgb = col;
  }`;

/** Per-paint cache, so every copy of a model shares one painted material per source. */
const cache = new WeakMap<Paint, WeakMap<THREE.Material, THREE.MeshBasicMaterial>>();

/** A model's own colours (palette or texture), painted. */
export function painted(src: THREE.Material, haze: Haze, paint: Paint): THREE.MeshBasicMaterial {
  let map = cache.get(paint);
  if (!map) cache.set(paint, (map = new WeakMap()));
  let m = map.get(src);
  if (!m) {
    const s = src as THREE.MeshStandardMaterial;
    m = paintMaterial(
      new THREE.MeshBasicMaterial({
        color: s.color,
        map: s.map,
        side: s.side,
        alphaTest: s.alphaTest,
      }),
      haze,
      paint,
      'wood',
    );
    map.set(src, m);
  }
  return m;
}

/** A model painted from its own sheet (the village, the farm): its colours, with cel light. */
export function paintedAtlas(
  src: THREE.Material,
  haze: Haze,
  paint: Paint,
): THREE.MeshBasicMaterial {
  let map = cache.get(paint);
  if (!map) cache.set(paint, (map = new WeakMap()));
  let m = map.get(src);
  if (!m) {
    const s = src as THREE.MeshStandardMaterial;
    m = paintMaterial(
      new THREE.MeshBasicMaterial({ color: s.color, map: s.map, side: s.side }),
      haze,
      paint,
      'atlas',
    );
    map.set(src, m);
  }
  return m;
}
