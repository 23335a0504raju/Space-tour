import * as THREE from 'three';

/**
 * Night atmosphere for SC05: sky dome, cloud layers and the haze-fading ground. All three share
 * the same horizon colour so the far edge of every flat layer dissolves into the sky (the camera's
 * far plane is 2 km; no hard edges may show).
 */
export const HORIZON = new THREE.Color('#1a2742');
export const ZENITH = new THREE.Color('#050912');

const noiseGlsl = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

// ── Sky dome ───────────────────────────────────────────────────────────────────
/** Camera-centred dome: horizon glow → zenith; `uThin` (altitude) darkens it to space black. */
export function createSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHorizon: { value: HORIZON.clone() },
      uZenith: { value: ZENITH.clone() },
      uThin: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon; uniform vec3 uZenith; uniform float uThin;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.45, h));
        // the horizon band sinks and dims with altitude
        float band = exp(-abs(h + 0.04 * uThin) * (14.0 + 30.0 * uThin));
        col += uHorizon * band * 0.6 * (1.0 - 0.5 * uThin);
        // high up the sky goes black above a thin glowing horizon line
        col *= 1.0 - 0.9 * uThin * smoothstep(-0.03, 0.25, h);
        // below the horizon: the dark night Earth beyond the far edge of the ground and deck
        col = mix(col, vec3(0.006, 0.008, 0.012), smoothstep(-0.005, -0.06, h));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

// ── Ground ─────────────────────────────────────────────────────────────────────
export function createGroundMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHorizon: { value: HORIZON.clone() },
      uGlow: { value: 0 },
      uGlowPos: { value: new THREE.Vector3() },
      uThin: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon; uniform float uGlow; uniform vec3 uGlowPos; uniform float uThin;
      varying vec3 vWorld;
      ${noiseGlsl}
      void main() {
        float d = length(vWorld.xz - cameraPosition.xz);
        vec3 base = vec3(0.012, 0.014, 0.018) * (0.8 + 0.4 * noise(vWorld.xz * 0.02));
        // exhaust light pool on the ground around the pad
        float g = uGlow * 40.0 / (40.0 + dot(vWorld - uGlowPos, vWorld - uGlowPos) * 0.5);
        base += vec3(1.0, 0.45, 0.15) * g * 0.5;
        // aerial perspective: dissolve into the horizon colour before the far plane
        float haze = smoothstep(250.0 + 600.0 * uThin, 1500.0, d);
        gl_FragColor = vec4(mix(base, uHorizon * 0.9, haze), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// ── Cloud layer ────────────────────────────────────────────────────────────────
/**
 * One horizontal cloud sheet (a stack of these makes the deck). fBm coverage, moonlit tops,
 * underlit by the exhaust when the ship is near (uGlow at uGlowPos), faded near the camera so a
 * sheet never fills the screen as a flat wall, and faded with distance into the horizon.
 */
export function createCloudMaterial(seed: number, octaves: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: seed },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uGlowPos: { value: new THREE.Vector3() },
      uOpacity: { value: 0.8 },
      uHorizon: { value: HORIZON.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uSeed; uniform float uTime; uniform float uGlow; uniform vec3 uGlowPos;
      uniform float uOpacity; uniform vec3 uHorizon;
      varying vec3 vWorld;
      ${noiseGlsl}
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < ${octaves}; i++) { v += a * noise(p); p = p * 2.07 + 17.0; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vWorld.xz * 0.006 + vec2(uSeed * 13.1, uSeed * 7.7) + vec2(uTime * 0.004, 0.0);
        float n = fbm(p);
        float cover = smoothstep(0.42, 0.72, n);
        if (cover < 0.01) discard;
        float camDist = length(vWorld - cameraPosition);
        float horiz = length(vWorld.xz - cameraPosition.xz);
        // near the camera: thin out (no flat wall), far: dissolve into the horizon
        float near = smoothstep(8.0, 70.0, abs(vWorld.y - cameraPosition.y) + camDist * 0.12);
        float far = 1.0 - smoothstep(900.0, 1700.0, horiz);
        vec3 moon = vec3(0.11, 0.13, 0.19) * (0.6 + 0.5 * n);
        // a local glow around the plume only (it used to wash the whole deck brown)
        float g = uGlow * 500.0 / (500.0 + dot(vWorld - uGlowPos, vWorld - uGlowPos));
        vec3 col = moon + vec3(1.0, 0.5, 0.2) * g * 0.7;
        col = mix(col, uHorizon, 1.0 - far);
        gl_FragColor = vec4(col, cover * uOpacity * near * far);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ── Smoke billboards ───────────────────────────────────────────────────────────
/**
 * Instanced camera-facing quads. Per instance: centre (vec3), size, opacity, rotation, and how
 * much exhaust light reaches it. Soft procedural puff (no texture fetch).
 */
export function createSmokeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 iCenter;
      attribute vec4 iParams; // size, alpha, rotation, lit
      varying vec2 vUv; varying float vAlpha; varying float vLit; varying float vSeed;
      void main() {
        vUv = uv;
        vAlpha = iParams.y; vLit = iParams.w; vSeed = iCenter.x * 0.13 + iCenter.z * 0.07;
        float c = cos(iParams.z), s = sin(iParams.z);
        vec2 q = mat2(c, -s, s, c) * position.xy * iParams.x;
        vec4 mv = viewMatrix * vec4(iCenter, 1.0);
        mv.xy += q;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying vec2 vUv; varying float vAlpha; varying float vLit; varying float vSeed;
      ${noiseGlsl}
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float puff = smoothstep(1.0, 0.2, r) * (0.6 + 0.6 * noise(vUv * 4.0 + vSeed));
        float a = puff * vAlpha;
        if (a < 0.004) discard;
        vec3 base = vec3(0.085, 0.095, 0.12); // night smoke: dark unless lit
        vec3 lit = vec3(1.0, 0.42, 0.12) * uGlow * vLit * 1.1;
        gl_FragColor = vec4(base * (0.35 + 0.65 * (1.0 - r)) + lit, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
