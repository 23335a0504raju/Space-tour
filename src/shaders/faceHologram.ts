import * as THREE from 'three';

/**
 * The desk hologram of Raju (room/Hologram.tsx): his cut-out figure as projected light, not a
 * see-through person. A cyan ramp built from the photo's own light and shade (local contrast kept,
 * so the face still reads), dark areas the most transparent, a fresnel-like glow along the
 * silhouette and a soft halo outside it, horizontal scan lines, a sweeping scan bar that bends the
 * picture as it passes, a rare small slip of one slice, and a faint flicker. The waist dissolves
 * into the projector's beam.
 *
 * Output is premultiplied: the figure covers what is behind it only as far as its alpha, and the
 * glows add light on top. Soft edges come from the texture's own mip levels (no blur taps).
 * `uTime` is ambient (seconds); nothing here carries story state. LITE (Low tier) drops the local
 * contrast sample and the slice slip.
 */
// the picture stays flat: pushing the face into a relief swelled it when seen from the side
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uTime;

  // KTX2 rows run top-down
  vec2 flip(vec2 p) {
    return vec2(p.x, 1.0 - p.y);
  }

  float hash(float n) {
    return fract(sin(n * 91.345) * 47453.17);
  }

  float shade(vec3 c) {
    return pow(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0), 0.55);
  }

  void main() {
    float t = uTime;
    // the scan bar climbs the figure every few seconds and bends the picture where it is
    float sweepAt = fract(t * 0.23) * 1.5 - 0.2;
    float sweep = exp(-pow((vUv.y - sweepAt) / 0.028, 2.0));

    vec2 p = vUv;
    p.x += 0.0006 * sin(vUv.y * 52.0 + t * 2.3) + sweep * 0.0035 * sin(vUv.y * 380.0 + t * 9.0);
    #ifndef LITE
      // now and then (about once in three seconds, for a tenth of one) a thin slice slips sideways
      float slot = floor(t * 0.34);
      float live = step(fract(t * 0.34), 0.045);
      float slice = step(abs(vUv.y - (0.3 + 0.6 * hash(slot))), 0.018);
      p.x += live * slice * (hash(slot + 7.0) - 0.5) * 0.045;
    #endif

    vec4 tex = texture2D(uMap, flip(p));
    float body = tex.a;
    float wide = textureLod(uMap, flip(p), 3.0).a;

    // never let the picture's own rectangle show; the waist dissolves into the beam
    float frame = smoothstep(0.0, 0.07, vUv.x) * smoothstep(0.0, 0.07, 1.0 - vUv.x) *
      smoothstep(0.0, 0.03, 1.0 - vUv.y);
    float fade = smoothstep(0.02, 0.34, vUv.y) * frame;

    float rim = body * (1.0 - smoothstep(0.5, 0.99, wide));
    float halo = (1.0 - body) * smoothstep(0.03, 0.55, wide);
    if ((body + halo) * fade < 0.012) discard;

    float light = min(shade(tex.rgb) * 1.1, 1.0);
    #ifndef LITE
      light = clamp(light + (shade(tex.rgb) - shade(textureLod(uMap, flip(p), 3.2).rgb)) * 0.85,
        0.0, 1.0);
    #endif

    vec3 colour = mix(vec3(0.0, 0.09, 0.3), vec3(0.0, 0.52, 0.92), smoothstep(0.02, 0.52, light));
    colour = mix(colour, vec3(0.66, 0.97, 1.0), smoothstep(0.48, 0.97, light));
    colour = mix(colour, tex.rgb * vec3(0.55, 1.0, 1.25), 0.1);

    // scan lines drifting upward; they fade out before they get finer than the pixels
    float phase = vUv.y * 80.0 - t * 1.6;
    float lines = 0.5 + 0.5 * cos(phase * 6.2832);
    float sharp = 1.0 - smoothstep(0.28, 0.55, fwidth(phase));
    float scan = mix(1.0, 0.5 + 0.72 * lines, sharp);
    float bands = 0.92 + 0.08 * sin(vUv.y * 19.0 - t * 1.4);
    // faint flicker, with a rare shallow dip: far below anything that reads as flashing
    float flicker = 0.96 + 0.03 * sin(t * 17.0) * sin(t * 5.3) -
      0.07 * step(0.98, hash(floor(t * 11.0)));

    float alpha = body * mix(0.36, 0.92, light) * mix(0.82, 1.0, scan - 0.22) * fade * flicker;
    vec3 glow = vec3(0.05, 0.6, 1.0) * (rim * 0.75 + halo * 0.3) +
      vec3(0.25, 0.75, 1.0) * sweep * body * 0.45;

    gl_FragColor = vec4(colour * scan * bands * flicker, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef LITE
      // straight to the screen, added light lands brighter than through the post pass
      glow *= 0.6;
    #endif
    gl_FragColor = vec4(gl_FragColor.rgb * alpha + glow * fade * flicker, alpha);
  }
`;

export function createFaceHologramMaterial(map: THREE.Texture, lite: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 } },
    defines: lite ? { LITE: '' } : {},
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
