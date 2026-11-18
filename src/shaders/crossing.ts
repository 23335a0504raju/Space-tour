import * as THREE from 'three';

/** SC10 shaders: the gate's anomaly (a swirling lens disc) and the tunnel walls. Ambient motion only. */

export function createAnomalyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpen; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        // spiral arms pulled toward the centre: reads as lensing
        float arms = sin(a * 5.0 + log(max(r, 0.02)) * 9.0 - uTime * 0.8) * 0.5 + 0.5;
        float core = smoothstep(0.55, 0.0, r);
        float rim = smoothstep(0.7, 1.0, r) * (1.0 - smoothstep(0.96, 1.0, r));
        vec3 cold = vec3(0.35, 0.6, 1.0);
        vec3 warm = vec3(1.0, 0.62, 0.3);
        vec3 col = mix(cold, warm, core) * (0.25 + 0.9 * arms * (1.0 - r * 0.5)) + warm * rim * 0.8;
        float alpha = (0.2 + 0.7 * core + 0.5 * rim) * uOpen;
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createTunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        // u = around the tunnel, v = along it
        float lanes = abs(sin(vUv.x * 3.14159 * 18.0));
        float bands = fract(vUv.y * 22.0 - uTime * 0.6);
        float line = smoothstep(0.08, 0.0, abs(bands - 0.5) - 0.38) * 0.0 + smoothstep(0.5, 0.46, abs(bands - 0.5));
        float laneLine = smoothstep(0.93, 1.0, lanes);
        vec3 a = vec3(0.12, 0.25, 0.6);
        vec3 b = vec3(0.7, 0.28, 0.6);
        vec3 col = mix(a, b, vUv.y) * (0.25 + 0.6 * line) + vec3(0.6, 0.85, 1.0) * laneLine * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
  });
}

/**
 * SC10 black hole (Interstellar / Gargantua look), drawn on one camera-facing quad. Units are
 * horizon radii. An analytic approximation, not a ray tracer: a black horizon, a thin photon
 * ring, the near half of a tilted accretion disk crossing in front, and the far half bent over
 * the top and bottom (the lensed image), with Keplerian shear and a doppler-bright left side.
 * Output is premultiplied: rgb is emission, alpha is the horizon's coverage (it hides what is
 * behind, such as the ship being swallowed). Pure function of uniforms: reversible.
 *   uOpen  0..1  how far the disk has ignited (story)
 *   uTime        ambient disk rotation (clock time, no story meaning)
 *   uLow   0|1   one noise octave instead of two
 */
export const BLACK_HOLE_EXTENT = 6.5;

export function createBlackHoleMaterial(low: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 },
      uFade: { value: 1 },
      uLow: { value: low ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uOpen; uniform float uFade; uniform float uLow; varying vec2 vUv;
      const float EXT = ${BLACK_HOLE_EXTENT.toFixed(1)};
      const float INCL = 0.14;
      const float RIN = 1.55;
      const float ROUT = 5.3;

      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x){
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      // disk emission at radius rho, azimuth phi: hot and bright inside, ragged streaks, sheared
      float disk(float rho, float phi){
        rho = max(rho, 0.05); // pow() of a negative base is NaN, and one NaN pixel blooms over the frame
        float edge = smoothstep(RIN, RIN + 0.3, rho) * (1.0 - smoothstep(ROUT - 2.4, ROUT, rho));
        float prof = pow(RIN / rho, 1.9);
        float ang = phi + uTime * 0.9 * pow(rho, -1.5);
        vec3 c = vec3(cos(ang), sin(ang), 0.0) * 2.2 + vec3(0.0, 0.0, rho * 3.2);
        float n = vnoise(c * 1.4) * 0.6;
        n += (uLow > 0.5) ? 0.2 : vnoise(c * 4.2) * 0.4;
        return edge * prof * (0.45 + 1.1 * n);
      }
      vec3 heat(float v){
        // outer deep orange to inner white-gold
        return mix(vec3(0.95, 0.32, 0.06), vec3(1.0, 0.86, 0.6), clamp(v * 0.9, 0.0, 1.0));
      }
      void main(){
        vec2 p = (vUv * 2.0 - 1.0) * EXT;
        float r = length(p);
        // atan(0, 0) is undefined: flying exactly at the centre gave one NaN pixel, which bloom spread
        // over the whole frame (the black flicker). Nudge off the origin.
        float phi = atan(p.y, p.x + 1e-4);
        float dop = 1.0 - 0.5 * clamp(p.x / max(r, 0.001), -1.0, 1.0);

        // direct disk: the tilted ring seen as a thin ellipse; the far half hides behind the horizon
        vec2 q = vec2(p.x, p.y / sin(INCL));
        float rho = length(q);
        float direct = disk(rho, atan(q.y, q.x + 1e-4));
        if (p.y > 0.0) direct *= smoothstep(0.98, 1.05, r);

        // lensed image: the far side of the disk bent over the top and under the bottom
        float lr = RIN + (r - 1.0) * 2.4;
        float lens = disk(lr, phi) * smoothstep(1.0, 1.05, r) * (1.0 - smoothstep(1.3, 2.3, r)) * 1.6;

        // photon ring and a faint glow hugging the horizon
        float rx = (r - 1.04) / 0.035;
        float ring = exp(-rx * rx) * 1.6;
        float glow = (r > 1.0) ? exp(-(r - 1.0) * 3.5) * 0.18 : 0.0;

        float e = (direct + lens) * dop;
        vec3 col = heat(e) * e * 1.25 + vec3(1.0, 0.9, 0.75) * (ring + glow);
        col *= uOpen * uFade;
        // the horizon itself: opaque black, hides everything behind it; the near disk passes in front
        float cover = (1.0 - smoothstep(0.985, 1.0, r)) * uFade;
        if (p.y < 0.0) cover *= 1.0 - smoothstep(0.0, 0.01, direct);
        vec4 outc = vec4(col * (1.0 - smoothstep(EXT * 0.8, EXT, r)), cover);
        if (any(isnan(outc)) || any(isinf(outc))) outc = vec4(0.0, 0.0, 0.0, cover);
        gl_FragColor = outc;
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

/**
 * The fall: inside the horizon the sky is gone. A dark void with a few thin, red-shifted streaks of
 * starlight behind us and blue-shifted ones ahead, a faint photon glow where we came in, and a
 * light at the far end that grows as it nears (the way out). uReveal 0..1 fades it in as the
 * camera is swallowed (a pure function of position).
 */
export function createFallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uReveal; varying vec2 vUv;
      float hash(float n){ return fract(sin(n * 91.345) * 43758.5453); }
      void main(){
        // v can land a hair outside 0..1 at the cylinder rim; pow() of a negative base is NaN and
        // one NaN pixel blooms over the whole frame (the intermittent black screen)
        float v = clamp(vUv.y, 0.0, 1.0);
        // u = around the tunnel, v = along it (v = 1 at the horizon, v = 0 at the exit)
        float lane = floor(vUv.x * 64.0);
        float across = abs(fract(vUv.x * 64.0) - 0.5);
        float h = hash(lane);
        float on = step(0.8, h);
        float along = fract(v * (2.0 + h * 5.0) + uTime * (0.15 + h * 0.4) + hash(lane + 7.0));
        float streak = on * (1.0 - smoothstep(0.1, 0.2, across)) * smoothstep(0.0, 0.04, along) * (1.0 - smoothstep(0.08, 0.45, along));
        vec3 shift = mix(vec3(1.0, 0.42, 0.16), vec3(0.7, 0.85, 1.0), 1.0 - v);
        vec3 col = shift * streak * 0.9;
        col += vec3(1.0, 0.5, 0.18) * pow(v, 14.0) * 0.5;
        float way = pow(1.0 - v, 14.0);
        col += vec3(1.0, 0.93, 0.8) * way * 3.0;
        vec3 outc = col * uReveal;
        if (any(isnan(outc)) || any(isinf(outc))) outc = vec3(0.0);
        gl_FragColor = vec4(outc, 1.0);
      }`,
    side: THREE.BackSide,
    // a backdrop: drawn first, never occluding the ship or the world beyond
    depthWrite: false,
    depthTest: false,
  });
}
