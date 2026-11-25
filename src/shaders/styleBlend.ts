import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Screen-space art-style blend (SC10 crossing, SC11 anime universe, SC12 return).
 *   uStyle 0 = realistic (untouched), 1 = the scene inked (lines, hatching), 2 = flat cel colour
 *   with ink lines. No paper-white stage: the ramp never flashes bright between dark and painted.
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
    vec4 ta = texture2D(inputBuffer, uv);
    vec4 tb = texture2D(inputBuffer, uv + vec2(px.x, px.y));
    vec4 tc = texture2D(inputBuffer, uv + vec2(px.x, 0.0));
    vec4 td = texture2D(inputBuffer, uv + vec2(0.0, px.y));
    float a = lum(ta.rgb);
    float b = lum(tb.rgb);
    float c = lum(tc.rgb);
    float d = lum(td.rgb);
    float edge = length(vec2(a - b, c - d));
    // Painted clouds (anime/parts.tsx Clouds) mark themselves by lowering alpha: they are already
    // painted, so no ink round or inside them and no posterising. Opaque scene pixels have alpha 1.
    float painted = 1.0 - clamp(min(min(ta.a, tb.a), min(tc.a, td.a)), 0.0, 1.0);
    float cloud = 1.0 - clamp(inputColor.a, 0.0, 1.0);
    float ink = smoothstep(0.012, 0.05, edge) * (1.0 - painted);

    float l = lum(inputColor.rgb);

    // ── ink line art over the scene itself: hatching where it is bright, ink lines ──
    // (Raju, 2026-11-25: no paper flash. It used to be drawn on a paper-white page, a near-white
    // frame between dark space and the painted sky; now the real image takes on ink first, then
    // the cel colour floods in.)
    vec3 inkCol = vec3(0.08, 0.07, 0.11);
    float hatch = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.18));
    float shade = smoothstep(0.12, 0.7, l);
    vec3 lineArt = inputColor.rgb * (1.0 - 0.28 * hatch * shade);
    lineArt = mix(lineArt, inkCol, ink);

    // ── cel colour: posterised, saturated, with a painted sky behind everything dark ──
    vec3 sky = mix(vec3(0.13, 0.12, 0.36), vec3(0.98, 0.52, 0.5), smoothstep(0.0, 1.0, uv.y * 0.9));
    float lv = max(l, 1e-3);
    float q = floor(l * 4.0 + 0.5) / 4.0;
    vec3 base = inputColor.rgb * (q / lv);
    base = mix(vec3(lum(base)), base, 1.45);
    base = mix(base, inputColor.rgb, cloud);
    vec3 cel = mix(sky, base, smoothstep(0.025, 0.1, l));
    cel = mix(cel, inkCol, ink * 0.9);

    float k1 = clamp(uStyle, 0.0, 1.0);
    float k2 = clamp(uStyle - 1.0, 0.0, 1.0);
    vec3 outRgb = mix(mix(inputColor.rgb, lineArt, k1), cel, k2);
    // the clouds' mark is consumed here: the page behind the canvas is near-black, so opaque output
    // looks the same everywhere else
    outputColor = vec4(outRgb, 1.0);
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
