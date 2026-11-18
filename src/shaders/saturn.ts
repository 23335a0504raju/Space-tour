import * as THREE from 'three';

/**
 * Saturn for SC09: a banded planet and a procedural ring system. The scene is backlit (Sun behind
 * the planet): the planet is dark with a glowing limb, the rings glow by forward scattering, and
 * the planet casts a real shadow across them (ray-sphere test per fragment).
 */
const HASH = /* glsl */ `
  float hash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
  float noise1(float x){ float i = floor(x); float f = fract(x); f = f*f*(3.0-2.0*f); return mix(hash(i), hash(i+1.0), f); }
`;

export function createSaturnMaterial(sun: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vObj = normalize(position);
        vec4 w = modelMatrix * vec4(position,1.0);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying vec3 vObj;
      ${HASH}
      void main(){
        vec3 n = normalize(vN);
        float lat = vObj.y;
        float warp = noise1(lat * 9.0 + 3.0) * 0.8 + noise1(lat * 31.0) * 0.25;
        float bands = sin(lat * 22.0 + warp * 3.0) * 0.5 + 0.5;
        vec3 a = vec3(0.80, 0.66, 0.42);
        vec3 b = vec3(0.93, 0.85, 0.66);
        vec3 c = vec3(0.55, 0.40, 0.24);
        vec3 albedo = mix(mix(a, b, bands), c, smoothstep(0.55, 1.0, abs(lat)) * 0.6);
        float d = dot(n, uSun);
        float diffuse = max(d, 0.0);
        // backlit: mostly dark face, light leaking round the limb and a faint ring-shine
        float ndv = max(dot(n, normalize(vV)), 0.0);
        float rim = pow(1.0 - ndv, 3.0);
        float lit = smoothstep(-0.55, 0.15, d);
        vec3 col = albedo * (0.035 + 1.4 * diffuse);
        col += vec3(1.0, 0.72, 0.4) * rim * (0.15 + 1.6 * lit);
        col += albedo * 0.05;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export const MAX_BANDS = 5;

export function createRingMaterial(
  sun: THREE.Vector3,
  planetRadius: number,
  inner: number,
  outer: number,
  bandRanges: ReadonlyArray<readonly [number, number]>,
) {
  const ranges = bandRanges.flatMap((r) => [r[0], r[1]]);
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sun.clone() },
      uR: { value: planetRadius },
      uInner: { value: inner },
      uOuter: { value: outer },
      uBand: { value: new Array<number>(MAX_BANDS).fill(0) },
      uRanges: { value: ranges },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vLocal;
      void main(){
        vLocal = position.xy;
        vec4 w = modelMatrix * vec4(position,1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform float uR; uniform float uInner; uniform float uOuter;
      uniform float uBand[${MAX_BANDS}]; uniform float uRanges[${MAX_BANDS * 2}];
      varying vec3 vW; varying vec2 vLocal;
      const vec3 TINT[5] = vec3[5](vec3(0.45,0.8,1.0), vec3(1.0,0.78,0.35), vec3(0.78,0.58,1.0), vec3(0.45,1.0,0.7), vec3(1.0,0.5,0.55));
      ${HASH}
      void main(){
        float r = length(vLocal);
        float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
        // ringlet structure + the Cassini-style gap between bands 3 and 4
        float fine = hash(floor(r * 6.0));
        float broad = noise1(r * 0.55) * 0.6 + noise1(r * 2.3) * 0.3;
        float dens = 0.35 + 0.5 * broad + 0.25 * fine;
        dens *= 1.0 - smoothstep(0.0, 0.03, t) * 0.0;
        dens *= 1.0 - 0.95 * (smoothstep(0.575, 0.585, t) - smoothstep(0.615, 0.625, t));
        dens *= smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.96, 1.0, t));

        // which stack band are we in, and how lit is it
        float glow = 0.0; float edge = 0.0; vec3 tint = vec3(0.0);
        for (int i = 0; i < ${MAX_BANDS}; i++) {
          float lo = uRanges[i * 2]; float hi = uRanges[i * 2 + 1];
          float inBand = step(lo, t) * step(t, hi);
          glow += inBand * uBand[i];
          tint += inBand * uBand[i] * TINT[i];
          edge += uBand[i] * (smoothstep(0.004, 0.0, abs(t - lo)) + smoothstep(0.004, 0.0, abs(t - hi)));
        }

        // planet shadow: does the ray from here toward the Sun hit the planet sphere?
        float b = dot(vW, uSun);
        float c = dot(vW, vW) - uR * uR;
        float disc = b * b - c;
        float shadow = smoothstep(0.0, uR * uR * 0.06, disc) * step(b, 0.0);

        // backlit: forward scattering, strongest looking toward the Sun
        vec3 v = normalize(cameraPosition - vW);
        float fs = pow(max(-dot(v, uSun), 0.0), 2.5);
        vec3 base = mix(vec3(0.78, 0.66, 0.46), vec3(0.95, 0.88, 0.7), noise1(r * 1.1));
        vec3 col = base * (0.18 + 1.5 * fs) * (1.0 - 0.93 * shadow);
        // lit band: cool-white lift, plus fine edge lines at its limits
        vec3 hi = vec3(0.8, 0.9, 1.0);
        vec3 tc = glow > 0.001 ? tint / glow : hi;
        col = mix(col, tc * (0.5 + 0.9 * fs), glow * 0.6) + hi * edge * 0.5;
        float alpha = dens * (0.55 + 0.4 * fs) + glow * 0.25 * dens;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
