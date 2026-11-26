import * as THREE from 'three';

/**
 * The Sun as a body (after Raju's reference, an SDO-style image, 2026-11-25): a deep red-orange
 * photosphere boiling with fine granulation, bright yellow-white activity regions, dark filaments,
 * limb darkening that reddens toward the edge; and a ragged flame fringe with prominences.
 *
 * The surface is HDR (the bright regions sit above the bloom threshold, so they glow); its motion is
 * ambient (`uTime`, clock seconds), never story state. Low tier: fewer noise octaves.
 */

const NOISE = /* glsl */ `
  float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
`;

function fbm(octaves: number) {
  return /* glsl */ `
  float fbm(vec3 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < ${octaves}; i++) { s += a * noise3(p); p = p * 2.07 + 13.3; a *= 0.5; }
    return s;
  }`;
}

export function createSunMaterial(lowCost: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main() {
        vP = normalize(position);
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      ${fbm(lowCost ? 3 : 5)}
      void main() {
        vec3 p = vP;
        float t = uTime * 0.03;
        // large-scale magnetic activity: slowly drifting, domain-warped
        vec3 warp = vec3(fbm(p * 1.6 + t), fbm(p * 1.6 + 5.2 - t), fbm(p * 1.6 + 9.4));
        float activity = fbm(p * 2.4 + warp * 1.8);
        // fine granulation (the boiling surface) and ridged filaments
        float gran = fbm(p * 22.0 + warp * 2.0 + t * 4.0);
        float ridge = 1.0 - abs(fbm(p * 7.0 + warp * 3.0) * 2.0 - 1.0);

        // mostly deep red-orange with dark mottling (AgX turns bright colours white, so everything
        // but the small hot cores stays saturated and below ~1)
        // AgX pulls oranges toward beige: feed it deep, saturated reds so they land fiery orange
        vec3 deep = vec3(0.13, 0.006, 0.0);
        vec3 orange = vec3(0.85, 0.11, 0.0);
        vec3 hot = vec3(1.0, 0.42, 0.03);
        // large structures lead (bright swirls, dark regions); granulation is fine texture on top
        float big = smoothstep(0.32, 0.68, activity * 0.75 + gran * 0.25);
        vec3 col = mix(deep, orange, big);
        col *= 0.78 + 0.44 * gran;
        // dark lanes and filaments between the active regions
        col *= 1.0 - 0.6 * smoothstep(0.74, 0.95, ridge) * (1.0 - smoothstep(0.58, 0.7, activity));
        // active regions: small, concentrated yellow-orange cores (only these bloom)
        // (fbm rarely passes ~0.75, so the thresholds sit where its peaks really are)
        float flare = smoothstep(0.55, 0.7, activity) * smoothstep(0.35, 0.8, gran);
        col = mix(col, hot * 1.2, flare * 0.85);
        col += vec3(1.0, 0.7, 0.25) * pow(smoothstep(0.62, 0.76, activity), 2.0) * gran * 2.2;
        // limb darkening, redder toward the edge, with a thin bright rim
        float mu = max(dot(normalize(vN), normalize(vV)), 0.0);
        col *= 0.4 + 0.6 * pow(mu, 0.5);
        col = mix(col * vec3(1.0, 0.5, 0.25), col, smoothstep(0.0, 0.45, mu));
        col += vec3(1.0, 0.22, 0.02) * pow(1.0 - mu, 5.0) * 0.9;
        gl_FragColor = vec4(col * 1.1, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * The fiery fringe round the disc, on a camera-facing quad of half-size `extent` (in Sun radii):
 * ragged flames from the limb (noise over angle and height, flickering), a few tall prominences, and
 * a soft red-orange glow beyond. Additive; the inside of the disc is left to the surface.
 */
export function createCoronaMaterial(lowCost: boolean, extent: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uExtent: { value: extent } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vQ;
      void main() {
        vQ = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uExtent;
      varying vec2 vQ;
      ${NOISE}
      ${fbm(lowCost ? 3 : 4)}
      void main() {
        vec2 q = vQ * uExtent;          // in Sun radii
        float r = length(q);
        if (r < 0.985) discard;          // the surface draws the disc
        float a = atan(q.y, q.x);
        float h = r - 1.0;                // height above the limb
        float t = uTime * 0.12;
        vec3 ring = vec3(cos(a) * 3.0, sin(a) * 3.0, t);
        // flame length varies round the limb and flickers
        float lick = fbm(ring + vec3(0.0, 0.0, h * 4.0));
        float flames = exp(-h / (0.035 + 0.11 * lick * lick)) * (0.6 + 0.8 * fbm(ring * 2.6 + h * 9.0));
        // a few tall prominences where the angular noise peaks
        float prom = smoothstep(0.66, 0.8, fbm(vec3(cos(a) * 1.4, sin(a) * 1.4, 7.0 + t * 0.2)));
        flames += prom * exp(-h / 0.22) * (0.5 + 0.7 * fbm(ring * 4.0 + h * 6.0));
        // soft glow beyond
        float glow = exp(-h / 0.3) * 0.16 + exp(-h / 1.4) * 0.03;
        vec3 fire = mix(vec3(0.95, 0.12, 0.0), vec3(1.0, 0.45, 0.05), clamp(flames * 0.8, 0.0, 1.0));
        vec3 col = fire * flames * 1.9 + vec3(0.9, 0.18, 0.02) * glow;
        float fade = 1.0 - smoothstep(uExtent * 0.8, uExtent, r);
        gl_FragColor = vec4(col * fade, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
