import * as THREE from 'three';

/**
 * Night atmosphere for SC05: sky dome, cloud layers and the haze-fading ground. All three share
 * the same horizon colour so the far edge of every flat layer dissolves into the sky (the camera's
 * far plane is 2 km; no hard edges may show).
 */
export const HORIZON = new THREE.Color('#1c1f3d');
export const ZENITH = new THREE.Color('#050912');

const noiseGlsl = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
`;

// ── Sky dome ───────────────────────────────────────────────────────────────────
/**
 * Camera-centred dome: horizon glow → zenith; `uThin` (altitude) darkens it to space black.
 * Optional Milky Way: the shared baked deep sky (DeepSky `bakeSky`), looked up through `uGalaxyRot`
 * (SC05 world → galaxy frame) so the band rises out of the horizon in the launch views. It is
 * extinguished near the horizon, where the magenta/violet airglow sits (review 2026-11-21: the Milky
 * Way photo). At h = 0 the colour is still exactly the horizon colour the ground and clouds fade to.
 */
export function createSkyMaterial(
  galaxy: THREE.Texture | null = null,
  galaxyRot: THREE.Matrix3 = new THREE.Matrix3(),
  bandNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  octaves = 4,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHorizon: { value: HORIZON.clone() },
      uZenith: { value: ZENITH.clone() },
      uThin: { value: 0 },
      uGalaxy: { value: galaxy },
      uGalaxyRot: { value: galaxyRot },
      uGalaxyGain: { value: galaxy ? 1 : 0 },
      uBandN: { value: bandNormal },
      /** sine of how far the horizon has dropped (SC05's curved planet at the top of the climb) */
      uDip: { value: 0 },
      /** opacity: SC05 lets the shared flight sky (behind it) take over at the top of the climb */
      uAlpha: { value: 1 },
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
      uniform sampler2D uGalaxy; uniform mat3 uGalaxyRot; uniform float uGalaxyGain; uniform vec3 uBandN; uniform float uDip; uniform float uAlpha;
      varying vec3 vDir;
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm3(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < ${octaves}; i++) { v += a * n3(p); p = p * 2.13 + vec3(5.1, 1.3, 8.7); a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y + uDip;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.45, h));
        // the horizon band sinks and dims with altitude
        float band = exp(-abs(h + 0.04 * uThin) * (14.0 + 30.0 * uThin));
        col += uHorizon * band * 0.6 * (1.0 - 0.5 * uThin);
        // airglow: a magenta layer a few degrees up, violet above it, fading toward the zenith
        float hs = max(h, 0.0);
        vec3 glow = vec3(0.13, 0.008, 0.07) * exp(-pow((hs - 0.018) / 0.045, 2.0))
                  + vec3(0.02, 0.004, 0.04) * exp(-hs * 9.0);
        col += glow * smoothstep(-0.01, 0.01, h) * (1.0 - 0.6 * uThin);
        // high up the sky goes black above a thin glowing horizon line
        col *= 1.0 - 0.9 * uThin * smoothstep(-0.03, 0.25, h);
        if (uGalaxyGain > 0.0) {
          vec3 g = uGalaxyRot * d;
          vec2 uv = vec2(atan(g.z, -g.x) / 6.2831853, 1.0 - acos(clamp(g.y, -1.0, 1.0)) / 3.1415927);
          vec3 mw = pow(texture2D(uGalaxy, uv).rgb, vec3(2.2));
          // photo contrast: drop the faint floor, deepen the dust lanes, keep the colour
          float lum = dot(mw, vec3(0.3, 0.55, 0.15));
          // steeper than linear so the lanes and the band edge separate; slightly cooled (AgX warms it)
          mw = mw * smoothstep(0.003, 0.05, lum) * (lum / (lum + 0.02)) * 2.4;
          mw *= vec3(0.86, 0.92, 1.12);
          // the dark rift and dust lanes (as in long-exposure photos): broad dark patches down the middle
          // of the band plus thin filaments that cross the bright core
          float b = dot(g, uBandN);
          vec3 wp = g * 6.0 + vec3(fbm3(g * 2.5)) * 1.8;
          float dust = fbm3(wp);
          float onBand = exp(-b * b / 0.04);
          float patches = smoothstep(0.44, 0.6, dust);
          float fil = smoothstep(0.8, 0.97, 1.0 - abs(2.0 * fbm3(wp * 2.3 + 7.0) - 1.0));
          mw *= 1.0 - onBand * max(0.95 * patches, 0.8 * fil);
          // mottled star clouds between the lanes
          mw *= 0.55 + 0.9 * smoothstep(0.3, 0.72, fbm3(g * 22.0 + 3.0));
          // roll off the highlights so the core stays a glow, not a flat cloud
          mw = mw / (1.0 + mw * 2.5);
          // atmospheric extinction: gone at the horizon, full a quarter of the way up
          float ext = smoothstep(0.0, 0.22, h);
          col += mw * uGalaxyGain * ext;
        }
        // below the horizon: the dark night Earth beyond the far edge of the ground and deck
        col = mix(col, vec3(0.006, 0.008, 0.012), smoothstep(-0.005, -0.06, h));
        // half-step dither: the dark gradients band on 8-bit displays
        float r = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (r - 0.5) / 255.0;
        gl_FragColor = vec4(col, uAlpha);
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
      varying vec2 vUv; varying float vAlpha; varying float vLit; varying float vSeed; varying vec2 vUp;
      void main() {
        vUv = uv;
        vLit = iParams.w; vSeed = iCenter.x * 0.13 + iCenter.z * 0.07;
        float c = cos(iParams.z), s = sin(iParams.z);
        mat2 rot = mat2(c, -s, s, c);
        vec2 q = rot * position.xy * iParams.x;
        // screen up expressed in the sprite's own (rotated) frame, so the underside stays at the bottom
        vUp = vec2(-s, c);
        vec4 mv = viewMatrix * vec4(iCenter, 1.0);
        // puffs close to the lens dissolve instead of filling the frame
        vAlpha = iParams.y * smoothstep(12.0, 38.0, -mv.z);
        mv.xy += q;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying vec2 vUv; varying float vAlpha; varying float vLit; varying float vSeed; varying vec2 vUp;
      ${noiseGlsl}
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        // billowed silhouette: the edge is eroded by noise, the core stays dense
        float n = fbm(vUv * 3.2 + vSeed);
        float body = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.7);
        float a = body * vAlpha * (0.75 + 0.5 * n);
        if (a < 0.004) discard;
        // height within the puff in world terms (unrotated), -1 bottom .. 1 top
        float h = dot(c * 2.0, vUp);
        // night smoke: cool grey, brighter toward the top (floodlit), darker inside
        vec3 base = mix(vec3(0.05, 0.055, 0.065), vec3(0.17, 0.185, 0.21), smoothstep(-0.8, 0.9, h) * (0.55 + 0.45 * n));
        // engine light only on the underside, and only near the pit
        float under = smoothstep(0.4, -0.9, h);
        vec3 lit = vec3(1.0, 0.45, 0.16) * uGlow * vLit * under * 1.6;
        gl_FragColor = vec4(base + lit, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
