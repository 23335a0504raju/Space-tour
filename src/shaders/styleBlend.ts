import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Screen-space art-style blend (SC10 crossing, SC11 anime universe, SC12 return).
 *   uStyle 0 = realistic (untouched), 1 = ink line art on paper, 2 = flat cel colour with ink lines.
 * It runs after tone mapping, on the final image, and is a pure function of `uStyle`, which the
 * Director derives from scroll progress, so the transition reverses exactly.
 */
const fragment = /* glsl */ `
  uniform float uStyle;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uStyle < 0.001) { outputColor = inputColor; return; }

    // Roberts-cross edges on luminance (4 taps): lines follow every colour boundary
    vec2 px = texelSize * 1.6;
    float a = lum(texture2D(inputBuffer, uv).rgb);
    float b = lum(texture2D(inputBuffer, uv + vec2(px.x, px.y)).rgb);
    float c = lum(texture2D(inputBuffer, uv + vec2(px.x, 0.0)).rgb);
    float d = lum(texture2D(inputBuffer, uv + vec2(0.0, px.y)).rgb);
    float edge = length(vec2(a - b, c - d));
    float ink = smoothstep(0.012, 0.05, edge);

    float l = lum(inputColor.rgb);

    // ── ink line art: dark paper-white page, hatching where the scene is bright, ink lines ──
    vec3 paper = vec3(0.93, 0.90, 0.84);
    vec3 inkCol = vec3(0.08, 0.07, 0.11);
    float hatch = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.18));
    float shade = smoothstep(0.12, 0.7, l);
    vec3 lineArt = paper * (1.0 - 0.3 * shade - 0.28 * hatch * shade);
    lineArt = mix(lineArt, inkCol, ink);

    // ── cel colour: posterised, saturated, with a painted sky behind everything dark ──
    vec3 sky = mix(vec3(0.13, 0.12, 0.36), vec3(0.98, 0.52, 0.5), smoothstep(0.0, 1.0, uv.y * 0.9));
    float lv = max(l, 1e-3);
    float q = floor(l * 4.0 + 0.5) / 4.0;
    vec3 base = inputColor.rgb * (q / lv);
    base = mix(vec3(lum(base)), base, 1.45);
    vec3 cel = mix(sky, base, smoothstep(0.025, 0.1, l));
    cel = mix(cel, inkCol, ink * 0.9);

    float k1 = clamp(uStyle, 0.0, 1.0);
    float k2 = clamp(uStyle - 1.0, 0.0, 1.0);
    vec3 outRgb = mix(mix(inputColor.rgb, lineArt, k1), cel, k2);
    outputColor = vec4(outRgb, inputColor.a);
  }
`;

export class StyleBlendEffect extends Effect {
  constructor() {
    super('StyleBlendEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['uStyle', new Uniform(0)]]),
    });
  }

  get style(): number {
    return (this.uniforms.get('uStyle')?.value as number | undefined) ?? 0;
  }

  set style(value: number) {
    const u = this.uniforms.get('uStyle');
    if (u) u.value = value;
  }
}
