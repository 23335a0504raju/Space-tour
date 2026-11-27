import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Gravitational lensing of everything behind a black hole (stars, ship, planets), as a screen-space
 * warp. A point-mass thin lens maps each pixel at radius r from the hole to the source direction
 * r - re^2 / r (screen-height units): far from the hole the sky is barely moved, at r = re the whole
 * sky behind the hole is smeared into the Einstein ring, and inside it the sky appears inverted.
 * `re` grows as the camera approaches. It is written by the black hole component from the camera
 * position (a pure function of scroll), so scrolling back undoes it exactly.
 */
export const lensState = { x: 0.5, y: 0.5, re: 0, aspect: 1.6, owner: '' };

/** Where the lensed picture at `uv` comes from. Shared with the style pass's depth samples. */
export const LENS_WARP = /* glsl */ `
  vec2 lensWarp(vec2 uv, vec2 center, float re, float aspect) {
    if (re < 0.0005) return uv;
    vec2 k = vec2(aspect, 1.0);
    vec2 d = (uv - center) * k;
    float r = max(length(d), 1e-4);
    float rs = r - re * re / r;
    return clamp(center + d / r * rs / k, 0.001, 0.999);
  }
`;

const fragment = /* glsl */ `
  ${LENS_WARP}
  uniform vec2 uCenter;
  uniform float uRe;
  uniform float uAspect;

  float lensMask = 1.0;

  void mainUv(inout vec2 uv) {
    lensMask = 1.0;
    if (uRe < 0.0005) return;
    float r = max(length((uv - uCenter) * vec2(uAspect, 1.0)), 1e-4);
    uv = lensWarp(uv, uCenter, uRe, uAspect);
    // inside the Einstein ring the inverted far sky would repeat the hole itself: keep it dark
    lensMask = smoothstep(0.9 * uRe, 1.0 * uRe, r);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = vec4(inputColor.rgb * lensMask, inputColor.a);
  }
`;

export class LensEffect extends Effect {
  constructor() {
    super('LensEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      // reads no depth itself: declared so it stays ahead of the style pass, which does
      // (styleBlend.ts OrderedToneMappingEffect)
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uCenter', new Uniform({ x: 0.5, y: 0.5 })],
        ['uRe', new Uniform(0)],
        ['uAspect', new Uniform(1.6)],
      ]),
    });
  }

  /** Copies the shared lens state into the shader uniforms (call once per frame). */
  sync(): void {
    const c = this.uniforms.get('uCenter')?.value as { x: number; y: number } | undefined;
    if (c) {
      c.x = lensState.x;
      c.y = lensState.y;
    }
    const re = this.uniforms.get('uRe');
    if (re) re.value = lensState.re;
    const a = this.uniforms.get('uAspect');
    if (a) a.value = lensState.aspect;
  }
}
