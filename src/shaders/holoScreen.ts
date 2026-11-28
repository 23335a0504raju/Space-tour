import * as THREE from 'three';
import { KIND, SCREEN } from '../chapters/holo/panes.ts';
import type { AtlasSize } from '../chapters/holo/panes.ts';
import { CODE, RADAR } from '../chapters/room/holoLayout.ts';

/**
 * Floating screens (holo/HoloPanes.tsx), after the see-through displays of science fiction films:
 * panes of clear glass with fine lit edges and a drifting reflection, and layers of bare light
 * (rings, hex fields, node networks) before and behind them. Pictures come from one atlas. At the
 * desk the code scrolls, the radar sweeps, the bars move and keys flare under the typing hands;
 * rings turn and nodes pulse everywhere; the cockpit's records hold still to be read. One material
 * and one geometry for each set.
 *
 * Output is premultiplied: glass dims what is behind it a little and adds its light on top. `uTime`
 * is ambient (seconds). `uOpen` (0 folded away, 1 open) is the only story value; each pane may start
 * later than the first (its delay), so a set assembles piece by piece.
 */
const vertexShader = /* glsl */ `
  attribute vec4 aRect;
  attribute vec4 aPane; // width, height (metres), kind, screen
  attribute vec4 aMotion; // float amplitude (metres), phase, whether it folds away, its delay
  attribute vec2 aLook; // brightness, softness
  uniform float uTime;
  uniform float uOpen;
  varying float vOpen;
  varying vec2 vLook;
  varying vec2 vUv;
  varying vec4 vRect;
  varying vec4 vPane;
  void main() {
    vUv = uv;
    vRect = aRect;
    vPane = aPane;
    vLook = aLook;
    vec3 p = position;
    p.y += aMotion.x * sin(uTime * 1.1 + aMotion.y);
    float own = clamp((uOpen - aMotion.w) / (1.0 - aMotion.w), 0.0, 1.0);
    vOpen = mix(1.0, own, aMotion.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const glslFloat = (n: number) => n.toFixed(4);

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform vec2 uAtlas;
  varying vec2 vUv;
  varying vec4 vRect;
  varying vec4 vPane;
  varying float vOpen;
  varying vec2 vLook;

  const vec3 CYAN = vec3(0.05, 0.62, 1.0);
  const vec3 GOLD = vec3(1.0, 0.52, 0.12);

  float hash(float n) {
    return fract(sin(n * 91.345) * 47453.17);
  }

  vec3 tap(vec2 p, vec2 dx, vec2 dy) {
    vec2 at = (vRect.xy + clamp(p, vec2(0.5), vRect.zw - 0.5)) / uAtlas;
    return textureGrad(uMap, vec2(at.x, 1.0 - at.y), dx, dy).rgb;
  }

  /**
   * The atlas at pixel p (from the pane's top left); gradients come from the unwrapped uv. A soft
   * pane reads a smaller mip level, with four taps round it so the blur stays smooth.
   */
  vec3 picture(vec2 p) {
    vec2 scale = vRect.zw / uAtlas;
    float wider = exp2(vLook.y);
    vec2 dx = dFdx(vUv) * scale * wider;
    vec2 dy = dFdy(vUv) * scale * wider;
    vec3 colour = tap(p, dx, dy);
    if (vLook.y < 0.01) return colour;
    // half a blurred pixel out, in atlas pixels
    vec2 r = 0.5 * (abs(dFdx(vUv)) + abs(dFdy(vUv))) * vRect.zw * (wider - 0.6);
    vec3 round_ = tap(p + r, dx, dy) + tap(p - r, dx, dy) +
      tap(p + vec2(r.x, -r.y), dx, dy) + tap(p - vec2(r.x, -r.y), dx, dy);
    return colour * 0.4 + round_ * 0.15;
  }

  /** A line of half width w at distance d (metres), softened to the pixel and dimmed as it thins. */
  float stroke(float d, float w) {
    float soft = max(fwidth(d), 1e-5);
    return (1.0 - smoothstep(w - soft, w + soft, abs(d))) * min(1.0, 2.0 * w / soft);
  }

  void main() {
    float t = uTime;
    int kind = int(vPane.z + 0.5);
    vec2 size = vPane.xy;
    vec3 light = vec3(0.0);
    float cover = 0.0;

    if (kind == ${KIND.screen}) {
      int screen = int(vPane.w + 0.5);
      bool record = screen == ${SCREEN.record};
      bool chip = screen == ${SCREEN.glass};
      vec2 q = (vUv - 0.5) * size; // metres from the centre
      // unfolding: first a bright line across, then it opens upward and downward
      vec2 opened = vec2(smoothstep(0.0, 0.45, vOpen), max(0.015, smoothstep(0.35, 1.0, vOpen)));
      vec2 d = size * 0.5 * opened - abs(q); // metres in from the edges
      float cut = min(0.03, 0.16 * size.y);
      float corner = (d.x + d.y - cut) * 0.7071;
      if (min(min(d.x, d.y), corner) < 0.0) discard;

      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * vRect.zw;
      vec2 s = p;
      if (screen == ${SCREEN.code} && p.x < ${glslFloat(CODE.width - 12)} &&
          p.y >= ${glslFloat(CODE.top)} &&
          p.y < ${glslFloat(CODE.top + CODE.line * CODE.lines)}) {
        // the listing climbs without end
        s.y = ${glslFloat(CODE.top)} + mod(p.y - ${glslFloat(CODE.top)} + t * 14.0,
          ${glslFloat(CODE.line * CODE.lines)});
      }
      vec3 art = picture(s);
      light = art * (record ? 1.15 : 1.25);

      // the line being written
      if (screen == ${SCREEN.code} && p.x < ${glslFloat(CODE.width - 12)}) {
        float row = exp(-pow((p.y - 468.0) / 11.0, 2.0));
        float caret = step(abs(p.x - 70.0), 3.0) * step(abs(p.y - 468.0), 11.0) *
          step(0.5, fract(t * 1.4));
        light += CYAN * row * 0.07 + GOLD * caret * 0.9;
      }
      // live bars under the engine diagram
      if (screen == ${SCREEN.engine} && p.x > 44.0 && p.x < vRect.z - 44.0) {
        float cell = floor((p.x - 44.0) / 17.0);
        float level = 0.5 + 0.3 * sin(t * 2.1 + cell * 0.61) + 0.2 * sin(t * 3.7 - cell * 1.37);
        float top = vRect.w - 36.0 - 106.0 * clamp(level, 0.05, 1.0);
        float bar = step(top, p.y) * step(p.y, vRect.w - 36.0) *
          step(fract((p.x - 44.0) / 17.0), 0.55) * step(0.3, fract(p.y / 9.0));
        light += mix(CYAN, GOLD, step(0.86, level)) * bar * 0.55;
      }
      // the radar's turning sweep
      if (screen == ${SCREEN.flight}) {
        vec2 r = p - vec2(${glslFloat(RADAR.x)}, ${glslFloat(RADAR.y)});
        float within = 1.0 - smoothstep(${glslFloat(RADAR.radius - 4)}, ${glslFloat(RADAR.radius)},
          length(r));
        float turn = fract((atan(r.y, r.x) - t * 0.9) / 6.2832);
        light += CYAN * within * pow(turn, 6.0) * 0.4 + art * within * pow(turn, 3.0) * 0.8;
      }

      // clear glass: faint scan lines, a reflection drifting across, a band travelling down
      float phase = q.y * 330.0 - t * 2.0;
      float sharp = 1.0 - smoothstep(0.25, 0.5, fwidth(phase));
      // gentle over text meant to be read
      float scan = mix(1.0, record ? 0.95 + 0.07 * cos(phase * 6.2832) :
        0.85 + 0.22 * cos(phase * 6.2832), sharp);
      float slant = q.x * 0.62 + q.y - (fract(t * 0.045 + vRect.x * 0.0007) - 0.5) * 1.5;
      float glint = exp(-pow(slant / 0.05, 2.0)) + 0.6 * exp(-pow((slant - 0.11) / 0.012, 2.0));
      float sweepAt = 1.25 - fract(t * 0.16 + (vRect.x + vRect.y) * 0.0003) * 1.5;
      float sweep = exp(-pow((vUv.y - sweepAt) / 0.02, 2.0));
      float edge = min(min(d.x, d.y), corner);
      float glow = exp(-edge / 0.011);

      // the edge: one fine line, short heavier brackets at the corners, a second line inset along
      // the sides, and scales of ticks along the foot and the left side
      float hair = stroke(edge - 0.0012, 0.00065);
      float reach = min(0.045, 0.2 * size.y);
      float bracket = stroke(edge - 0.0022, 0.0017) * step(d.x, reach) * step(d.y, reach);
      float rail = stroke(d.x - 0.0095, 0.0004) * step(abs(q.y), size.y * 0.26);
      float feet = stroke(fract(q.x / 0.009 + 0.5) - 0.5, 0.07) * step(d.y, 0.0105) *
        step(0.0058, d.y) * step(q.y, 0.0) * step(abs(q.x), size.x * 0.3);
      float sides = stroke(fract(q.y / 0.008 + 0.5) - 0.5, 0.08) * step(d.x, 0.0078) *
        step(0.0042, d.x) * step(q.x, 0.0) * step(abs(q.y), size.y * 0.24);

      light *= scan;
      light += CYAN * (glint * 0.028 + sweep * 0.05 + glow * 0.17 + hair * 0.9 + bracket * 1.5 +
        rail * 0.55 + feet * 0.5 + sides * 0.5);
      light += CYAN * (1.0 - opened.y) * 0.9;
      light += vec3(0.5, 0.8, 1.0) * bracket * 0.35;
      cover = record ? 0.72 : (chip ? 0.16 : 0.3);
    } else if (kind == ${KIND.dial}) {
      vec2 c = vUv - 0.5;
      float r = length(c);
      if (r > 0.495) discard;
      // the two outer bands turn against each other
      float a = r > 0.36 ? t * 0.16 : (r > 0.24 ? -t * 0.34 : 0.0);
      vec2 turned = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
      vec3 art = picture(vec2(turned.x + 0.5, 0.5 - turned.y) * vRect.zw);
      // it opens outward from its centre
      float reach = 1.0 - smoothstep(vOpen * 0.55 - 0.04, vOpen * 0.55, r);
      light = (art * 1.2 + CYAN * 0.015 * (1.0 - smoothstep(0.2, 0.49, r))) * reach;
    } else if (kind == ${KIND.decor}) {
      // it spreads from the middle
      if (max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) > 0.5 * smoothstep(0.0, 0.9, vOpen)) discard;
      vec2 p = vec2(vUv.x, 1.0 - vUv.y) * vRect.zw;
      vec3 art = picture(p);
      // the green points of light beat, each patch in its own time
      float green = smoothstep(0.05, 0.25, art.g - art.b);
      float cell = hash(floor(p.x / 40.0) * 7.0 + floor(p.y / 40.0) * 31.0);
      float beat = 0.55 + 0.9 * pow(0.5 + 0.5 * sin(t * (1.2 + 2.4 * cell) + cell * 40.0), 3.0);
      float run = exp(-pow((vUv.x - fract(t * 0.11 + vRect.y * 0.0011) * 1.6 + 0.3) / 0.06, 2.0));
      light = art * mix(1.0, beat, green) * (1.0 + 0.6 * run);
    } else if (kind == ${KIND.keys}) {
      vec3 art = picture(vec2(vUv.x, 1.0 - vUv.y) * vRect.zw);
      // keys under the typing hands flare one after another
      vec2 cell = floor(vec2(vUv.x * 13.0, vUv.y * 5.0));
      float tap = floor(t * 7.0);
      float struck = step(0.94, hash(cell.x + cell.y * 17.0 + tap * 3.1));
      float fade = 1.0 - fract(t * 7.0);
      light = art * (0.65 + 2.2 * struck * fade);
    } else if (kind == ${KIND.emitter}) {
      vec2 c = (vUv - 0.5) * size;
      float core = exp(-pow(c.y / 0.0035, 2.0)) * (1.0 - smoothstep(0.38, 0.5, abs(vUv.x - 0.5)));
      float spill = exp(-abs(c.y) / 0.012) * (1.0 - smoothstep(0.25, 0.5, abs(vUv.x - 0.5)));
      float dashes = step(0.5, fract(vUv.x * 26.0 - t * 0.7));
      light = CYAN * (core * (0.75 + 0.4 * dashes) + spill * 0.22) + vec3(0.22) * core;
    } else {
      // the beam: widening from the emitter to the screen, thinning as it rises
      float half_ = mix(${glslFloat(0.36)}, 0.5, vUv.y);
      float across = abs(vUv.x - 0.5) / half_;
      float body = 1.0 - smoothstep(0.55, 1.0, across);
      float rays = 0.65 + 0.35 * sin(vUv.x * 90.0 + t * 0.9) * sin(vUv.x * 37.0 - t * 1.4);
      float rise = smoothstep(0.8, 1.0, fract(vUv.y * 2.0 - t * 0.6));
      light = CYAN * body * (1.0 - vUv.y) * (rays * 0.14 + rise * 0.09);
    }

    float shown = smoothstep(0.0, 0.12, vOpen);
    light *= shown * vLook.x;
    cover *= shown;

    // faint flicker, far below anything that reads as flashing
    light *= 0.97 + 0.03 * sin(t * 13.0 + vPane.w * 2.0) * sin(t * 4.7);

    gl_FragColor = vec4(vec3(0.001, 0.014, 0.03), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 backing = gl_FragColor.rgb;
    gl_FragColor = vec4(light, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef LITE
      // straight to the screen, added light lands brighter than through the post pass
      gl_FragColor.rgb *= 0.82;
    #endif
    gl_FragColor = vec4(gl_FragColor.rgb + backing * cover, cover);
  }
`;

export function createHoloScreenMaterial(map: THREE.Texture, size: AtlasSize, lite: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uAtlas: { value: new THREE.Vector2(size.width, size.height) },
      uTime: { value: 0 },
      uOpen: { value: 1 },
    },
    defines: lite ? { LITE: '' } : {},
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
