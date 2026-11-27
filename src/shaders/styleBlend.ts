import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Screen-space art-style blend (SC10 crossing, SC11 anime universe, SC12 return).
 *   uStyle 0 = realistic (untouched), 1 = the scene inked (lines, hatching), 2 = flat cel colour
 *   with ink lines. No paper-white stage: the ramp never flashes bright between dark and painted.
 *   uBackdrop 1 = dark pixels are open space and take the painted sky (the SC10 crossing),
 *               0 = they are drawn things (dark wood, a black coat) and keep their own colour
 * It runs after tone mapping, on the final image, and is a pure function of `uStyle`, which the
 * Director derives from scroll progress, so the transition reverses exactly.
 */
const fragment = /* glsl */ `
  uniform float uStyle;
  uniform float uBackdrop;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  // Painted surfaces (anime/parts.tsx PAINTED_BLEND: clouds, the painted sun) write a constant 0.5
  // into alpha as they cover a pixel. Over drawn scenery alpha falls from 1 towards 0.5; over empty
  // space it rises from 0 towards 0.5. Exactly 0 is empty space, exactly 1 is ordinary scenery.
  float paintedCover(float a) {
    a = clamp(a, 0.0, 1.0);
    return a >= 0.5 ? 2.0 * (1.0 - a) : 2.0 * a;
  }

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
    // Painted surfaces are already painted: no ink round or inside them, no posterising. The mark
    // is looked for on both sides (the edge taps only go right and up), and counts at full
    // strength from a faint cover, so ink never bleeds round a soft edge.
    vec2 pm = texelSize * 3.0;
    float cm = max(
      max(paintedCover(texture2D(inputBuffer, uv - vec2(pm.x, 0.0)).a), paintedCover(texture2D(inputBuffer, uv - vec2(0.0, pm.y)).a)),
      max(paintedCover(texture2D(inputBuffer, uv + vec2(pm.x, 0.0)).a), paintedCover(texture2D(inputBuffer, uv + vec2(0.0, pm.y)).a))
    );
    cm = max(cm, max(max(paintedCover(ta.a), paintedCover(tb.a)), max(paintedCover(tc.a), paintedCover(td.a))));
    float painted = clamp(cm * 8.0, 0.0, 1.0);
    float cloud = paintedCover(inputColor.a);
    // nothing drawn here: the painted sky goes in, whatever its brightness (bloom over empty
    // space used to stay as a grey band round SC10's clouds)
    float empty = 1.0 - smoothstep(0.0, 0.02, inputColor.a);
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
    // painted surfaces stay under the bloom threshold, so AgX leaves them greyish: lift them
    // towards white (a screen curve, which keeps their tone order)
    vec3 lifted = 1.0 - (1.0 - inputColor.rgb) * (1.0 - inputColor.rgb);
    base = mix(base, lifted, cloud);
    // A drawn dark surface: the first posterise band would crush it to black, so it keeps its own
    // colour on a violet shadow floor (an anime shadow, never a hole in the picture).
    vec3 shadow = inputColor.rgb * 1.3 + vec3(0.07, 0.045, 0.095) * (1.0 - smoothstep(0.0, 0.125, l));
    vec3 drawn = mix(base, shadow, (1.0 - step(0.125, l)) * (1.0 - cloud));
    // over open space, dark pixels are the backdrop instead and take the painted sky
    vec3 cel = mix(drawn, mix(sky, base, smoothstep(0.025, 0.1, l)), uBackdrop);
    cel = mix(cel, sky + inputColor.rgb * 0.6, empty);
    // a painted surface over empty space (alpha between 0 and 0.5: a soft halo, a cloud's edge)
    // was blended over black. Undo that and lay it over the painted sky instead, or the partial
    // cover read as a dark pixel (a black ring round the sun's halo in SC10).
    float ia = clamp(inputColor.a, 0.0, 1.0);
    if (ia > 0.002 && ia < 0.5) {
      float cov = 2.0 * ia;
      vec3 own = inputColor.rgb / max(cov, 0.02);
      vec3 ownLifted = 1.0 - (1.0 - own) * (1.0 - own);
      cel = mix(sky, ownLifted, clamp(cov, 0.0, 1.0));
    } else if (ia >= 0.5 && ia < 0.995) {
      // partly painted over drawn scenery (alpha 1 towards 0.5). Over a dark backdrop (SC10's
      // space) the cel pass would keep the dim mix as a grey ring; estimate what is behind,
      // assuming the paint is bright (crowns, glow, sun), and treat a dark backdrop as sky.
      float cov = 2.0 * (1.0 - ia);
      float under = (l - 0.75 * cov) / max(1.0 - cov, 0.05);
      if (under < 0.05) {
        vec3 own = inputColor.rgb / max(cov, 0.02);
        vec3 ownLifted = 1.0 - (1.0 - own) * (1.0 - own);
        cel = mix(cel, mix(sky, ownLifted, clamp(cov, 0.0, 1.0)), uBackdrop);
      }
    }
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
      uniforms: new Map([
        ['uStyle', new Uniform(0)],
        ['uBackdrop', new Uniform(0)],
      ]),
    });
  }

  get style(): number {
    return (this.uniforms.get('uStyle')?.value as number | undefined) ?? 0;
  }

  set style(value: number) {
    const u = this.uniforms.get('uStyle');
    if (u) u.value = value;
  }

  get backdrop(): number {
    return (this.uniforms.get('uBackdrop')?.value as number | undefined) ?? 0;
  }

  set backdrop(value: number) {
    const u = this.uniforms.get('uBackdrop');
    if (u) u.value = value;
  }
}
