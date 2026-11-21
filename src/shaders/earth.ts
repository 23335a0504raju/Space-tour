import * as THREE from 'three';

/**
 * Earth for SC06: day map lit by the Sun, city-light map on the night side, a thin atmosphere shell
 * with a warm terminator. `uSun` is the only story uniform (written from sunrise.ts each frame).
 */
const vert = /* glsl */ `
  varying vec3 vN; varying vec2 vUv; varying vec3 vV;
  void main(){
    vN = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vec4 w = modelMatrix * vec4(position,1.0);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

export function createEarthMaterial(day: THREE.Texture, night: THREE.Texture, lowCost: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: day },
      uNight: { value: night },
      uSun: { value: new THREE.Vector3(0, 0, -1) },
      uLow: { value: lowCost ? 1 : 0 },
      /** < 1 only while SC05 fades the planet in over its flat ground (set `transparent` too) */
      uOpacity: { value: 1 },
    },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform float uLow;
      uniform float uOpacity;
      varying vec3 vN; varying vec2 vUv; varying vec3 vV;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
      }
      // one round light per cell at a jittered spot, normalised so its mean is 1; cellsPerPx blends
      // toward that mean once a cell is smaller than ~1 px (no aliasing, no squares)
      float cityDots(vec2 p, float cellsPerPx) {
        vec2 c = floor(p);
        vec2 j = vec2(h21(c), h21(c + 31.7)) * 0.6 + 0.2;
        float on = step(0.3, h21(c + 71.3));
        float r = 0.16 + 0.1 * h21(c + 5.1);
        vec2 q = fract(p) - j;
        float spot = exp(-dot(q, q) / (r * r)) * on * (0.6 + 0.8 * h21(c + 9.9));
        // mean of the dot field: on 0.7, area pi r^2 (r avg 0.21), brightness avg 1.0
        float mean = 0.7 * 3.1416 * 0.21 * 0.21;
        return mix(spot / mean, 1.0, smoothstep(0.35, 1.0, cellsPerPx));
      }
      void main(){
        vec3 n = normalize(vN);
        float d = dot(n, uSun);
        vec2 uvf = vec2(vUv.x, 1.0 - vUv.y); // KTX2 is not Y-flipped
        vec3 day = texture2D(uDay, uvf).rgb;
        // close up, the 2k night map's bilinear texels showed as blocky squares (review 2026-11-21).
        // 1) warp the lookup by a fraction of a texel so the lit areas get organic, not stair-step, edges
        vec2 mapPx = uvf * vec2(2048.0, 1024.0);
        vec2 warp = vec2(vnoise(mapPx * 1.3), vnoise(mapPx * 1.3 + 17.0)) - 0.5;
        vec3 nightRaw = texture2D(uNight, uvf + warp * vec2(1.6 / 2048.0, 1.6 / 1024.0)).rgb;
        // the map's dark land is blue; city lights are warm: key on red-over-blue
        float warm = max(nightRaw.r - nightRaw.b * 0.9, 0.0);
        float dens = smoothstep(0.03, 0.5, warm);
        // 2) break each lit area into fine round lights on two jittered grids (4x and 12x the map);
        //    each grid fades to its mean once a dot is under a pixel, so distant globes stay smooth
        float texPerPx = fwidth(mapPx.x);
        float dots = cityDots(uvf * vec2(8192.0, 4096.0), texPerPx * 4.0);
        if (uLow < 0.5) dots = dots * 0.55 + cityDots(uvf * vec2(24576.0, 12288.0) + 3.7, texPerPx * 12.0) * 0.45;
        // sodium orange, whiter in the dense cores
        vec3 night = mix(vec3(1.0, 0.56, 0.22), vec3(1.0, 0.82, 0.55), dens * dens) * dens * dots * 0.75;
        float lit = smoothstep(-0.06, 0.22, d);
        // ocean glint: a soft specular on dark blue water
        vec3 h = normalize(uSun + vV);
        // a tight sun glint: seen from far away a broad lobe read as a white blob on the ocean
        float spec = pow(max(dot(n,h),0.0), 900.0) * smoothstep(0.0,0.3,d);
        float water = smoothstep(0.25, 0.0, day.r - day.b * 0.4);
        vec3 col = day * (0.03 + 1.25 * max(d,0.0)) * lit;
        // night side: a faint blue earthshine so the dark hemisphere has form, not flat black
        col += (day * 0.012 + vec3(0.006, 0.010, 0.022)) * (1.0 - lit);
        col += night * 1.3 * (1.0 - lit);   // city lights
        // kept below the bloom threshold: a strong glint bloomed into a white disc on the ocean
        col += vec3(0.8,0.9,1.0) * spec * water * 0.09 * (1.0 - uLow);
        // warm band along the terminator
        float term = exp(-pow(d / 0.06, 2.0));
        col += vec3(0.9,0.38,0.12) * term * 0.035;
        // aerial haze toward the limb: blue on the day side, warm at the terminator
        float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 4.0);
        vec3 haze = vec3(0.3, 0.55, 1.0) * lit + vec3(1.0, 0.5, 0.2) * term * 0.3;
        col += haze * fres * fres * 0.6;
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
}

export function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(0, 0, -1) } },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){
        vec3 n = normalize(vN);
        float rim = pow(1.0 - abs(dot(n, normalize(vV))), 2.6);
        float d = dot(n, uSun);
        float lit = smoothstep(-0.35, 0.3, d);
        vec3 blue = vec3(0.25,0.5,1.0);
        vec3 warm = vec3(1.0,0.5,0.2);
        vec3 c = mix(blue, warm, exp(-pow(d / 0.22, 2.0)));
        float a = rim * (0.12 + 0.9 * lit);
        gl_FragColor = vec4(c * a, a);
      }`,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Soft atmosphere haze for any planet: a slightly larger back-face shell whose alpha is strongest at
 * the planet's limb and fades to nothing at the shell's own edge (no hard ring).
 */
export function createRimMaterial(color: string, intensity: number, power = 2.2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uK: { value: intensity },
      uP: { value: power },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position,1.0);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uK; uniform float uP; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = pow(abs(dot(normalize(vN), normalize(vV))), uP) * uK;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Limb atmosphere for a planet seen from low orbit (SC06). A back-face shell whose brightness comes
 * from how close each sight line passes the planet (optical depth ≈ exp(-height / scale height)), so
 * the limb is a thin bright line that fades upward with no ring or band. Colour comes from where that
 * closest point sits relative to the Sun: blue on the day side, gold at the terminator, and a strong
 * forward-scatter glow around the Sun itself.
 */
export function createLimbAtmosphereMaterial(radius: number, centre: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(0, 0, -1) },
      uCentre: { value: centre.clone() },
      uRadius: { value: radius },
      uH: { value: radius * 0.0075 },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uCentre; uniform float uRadius; uniform float uH; uniform float uFade;
      varying vec3 vW;
      void main(){
        vec3 rd = normalize(vW - cameraPosition);
        vec3 oc = uCentre - cameraPosition;
        vec3 closest = cameraPosition + rd * dot(oc, rd);
        vec3 toC = closest - uCentre;
        float h = max(length(toC) - uRadius, 0.0);
        float dens = exp(-h / uH);
        float sunUp = dot(normalize(toC), uSun);
        float day = smoothstep(-0.2, 0.3, sunUp);
        float twilight = exp(-pow((sunUp + 0.02) / 0.16, 2.0));
        float mu = max(dot(rd, uSun), 0.0);
        float forward = (pow(mu, 10.0) * 0.9 + pow(mu, 120.0) * 3.0) * smoothstep(-0.35, 0.0, sunUp);
        vec3 col = vec3(0.22, 0.48, 1.0) * day * 0.9
                 + vec3(1.0, 0.48, 0.18) * twilight * 1.1
                 + vec3(1.0, 0.78, 0.5) * forward
                 + vec3(0.04, 0.07, 0.14) * 0.35;
        float a = clamp(dens, 0.0, 1.0) * uFade;
        gl_FragColor = vec4(col * a, a);
      }`,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
