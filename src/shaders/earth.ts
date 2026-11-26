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

export interface EarthOptions {
  /**
   * The close, last views of Earth (SC12, SC13): a cloud layer with shadows, smoothed and detailed
   * ground (the map's texels showed as blocks up close), haze only at the true limb and a terminator
   * that warms the ground instead of adding a pink band. SC05–SC07 keep the original look.
   */
  readonly closeup?: boolean;
}

export function createEarthMaterial(
  day: THREE.Texture,
  night: THREE.Texture,
  lowCost: boolean,
  options: EarthOptions = {},
) {
  if (options.closeup) return createCloseEarthMaterial(day, night, lowCost);
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

/** Map size in texels (for the smoothed lookup); the KTX2 image carries it. */
function texSize(t: THREE.Texture): THREE.Vector2 {
  const img = t.image as { width?: number; height?: number } | undefined;
  return new THREE.Vector2(img?.width ?? 2048, img?.height ?? 1024);
}

/** See EarthOptions.closeup. */
function createCloseEarthMaterial(day: THREE.Texture, night: THREE.Texture, lowCost: boolean) {
  const octaves = lowCost ? 3 : 5;
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: day },
      uNight: { value: night },
      uDaySize: { value: texSize(day) },
      uSun: { value: new THREE.Vector3(0, 0, -1) },
      uLow: { value: lowCost ? 1 : 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec2 vUv; varying vec3 vV; varying vec3 vP; varying vec3 vSunO;
      uniform vec3 uSun;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vUv = uv;
        vP = normalize(position);
        // the Sun in the globe's own frame (clouds and their shadows turn with the globe)
        vSunO = normalize(transpose(mat3(modelMatrix)) * uSun);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay; uniform sampler2D uNight; uniform vec2 uDaySize;
      uniform vec3 uSun; uniform float uLow; uniform float uOpacity;
      varying vec3 vN; varying vec2 vUv; varying vec3 vV; varying vec3 vP; varying vec3 vSunO;

      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      float fbm(vec3 p) {
        float s = 0.0; float a = 0.5;
        for (int i = 0; i < ${octaves}; i++) { s += a * noise3(p); p = p * 2.03 + 7.1; a *= 0.5; }
        return s;
      }
      // cloud cover on the unit sphere: domain-warped fbm, banded a little by latitude (storm belts,
      // clearer subtropics), so it reads as weather and not as noise
      float clouds(vec3 p) {
        vec3 q = p * 4.2;
        vec3 warp = vec3(fbm(q + 3.1), fbm(q + 8.7), fbm(q + 1.9));
        float c = fbm(q * 1.6 + warp * 1.6);
        // fine erosion tears the edges into wisps and streaks (weather, not cotton)
        c -= 0.22 * fbm(p * 26.0 + warp * 3.0);
        float lat = abs(p.y);
        float belt = 0.07 * cos(lat * 9.0) - 0.06 * smoothstep(0.15, 0.35, lat) * smoothstep(0.55, 0.35, lat);
        return smoothstep(0.36, 0.56, c + belt);
      }
      // texel-smoothed lookup: removes the bilinear staircase when the map is magnified
      vec3 smoothDay(vec2 uv) {
        vec2 p = uv * uDaySize + 0.5;
        vec2 i = floor(p); vec2 f = p - i;
        f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return texture2D(uDay, (i + f - 0.5) / uDaySize).rgb;
      }
      // very close up the map's own compression blocks show: a softer mip averages them away, and
      // the procedural grain below supplies the fine texture instead
      vec3 closeDay(vec2 uv, float near) {
        vec3 sharp = smoothDay(uv);
        // a fixed coarser level (a bias barely moves the level when the map is this magnified),
        // four taps half a block apart so the compression blocks' hard edges melt
        vec2 o = 6.0 / uDaySize;
        vec3 soft = 0.25 * (
          textureLod(uDay, uv + vec2(o.x, o.y), 2.0).rgb + textureLod(uDay, uv + vec2(-o.x, o.y), 2.0).rgb +
          textureLod(uDay, uv + vec2(o.x, -o.y), 2.0).rgb + textureLod(uDay, uv - o, 2.0).rgb);
        return mix(sharp, soft, near);
      }
      float cityDots(vec2 p, float cellsPerPx) {
        vec2 c = floor(p);
        vec2 j = vec2(h21(c), h21(c + 31.7)) * 0.6 + 0.2;
        float on = step(0.3, h21(c + 71.3));
        float r = 0.16 + 0.1 * h21(c + 5.1);
        vec2 q = fract(p) - j;
        float spot = exp(-dot(q, q) / (r * r)) * on * (0.6 + 0.8 * h21(c + 9.9));
        float mean = 0.7 * 3.1416 * 0.21 * 0.21;
        return mix(spot / mean, 1.0, smoothstep(0.35, 1.0, cellsPerPx));
      }

      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float d = dot(n, uSun);
        vec2 uvf = vec2(vUv.x, 1.0 - vUv.y); // KTX2 is not Y-flipped
        // fine relief so a magnified map has texture rather than flat texels (fades out far away)
        vec2 mapPx = uvf * uDaySize;
        float texPerPx = fwidth(mapPx.x);
        float near = 1.0 - smoothstep(0.15, 0.6, texPerPx);
        vec3 day = closeDay(uvf, near);
        float grain = vnoise(mapPx * 2.0) * 0.4 + vnoise(mapPx * 6.0) * 0.35 + vnoise(mapPx * 17.0) * 0.25;
        day *= mix(1.0, 0.8 + 0.4 * grain, near);

        // city lights (as SC06)
        vec2 nightPx = uvf * vec2(2048.0, 1024.0);
        vec2 warp = vec2(vnoise(nightPx * 1.3), vnoise(nightPx * 1.3 + 17.0)) - 0.5;
        vec3 nightRaw = texture2D(uNight, uvf + warp * vec2(1.6 / 2048.0, 1.6 / 1024.0)).rgb;
        float warm = max(nightRaw.r - nightRaw.b * 0.9, 0.0);
        float dens = smoothstep(0.03, 0.5, warm);
        float npx = fwidth(nightPx.x);
        float dots = cityDots(uvf * vec2(8192.0, 4096.0), npx * 4.0);
        if (uLow < 0.5) dots = dots * 0.55 + cityDots(uvf * vec2(24576.0, 12288.0) + 3.7, npx * 12.0) * 0.45;
        vec3 city = mix(vec3(1.0, 0.56, 0.22), vec3(1.0, 0.82, 0.55), dens * dens) * dens * dots * 0.75;

        // clouds, and the shadow they cast (the same field, looked up toward the Sun)
        float cl = clouds(vP);
        float shade = uLow < 0.5 ? clouds(normalize(vP + vSunO * 0.012)) : cl;

        float lit = smoothstep(-0.04, 0.2, d);
        float term = exp(-pow(d / 0.09, 2.0));
        vec3 h = normalize(uSun + v);
        float spec = pow(max(dot(n, h), 0.0), 600.0) * smoothstep(0.0, 0.3, d);
        float water = smoothstep(0.25, 0.0, day.r - day.b * 0.4);

        vec3 ground = day * (0.02 + 1.2 * max(d, 0.0)) * lit;
        ground *= 1.0 - 0.5 * shade * lit;                           // cloud shadows
        ground += vec3(0.8, 0.9, 1.0) * spec * water * 0.12 * (1.0 - cl) * (1.0 - uLow);
        // sunlit clouds: bright, a little grey in the thick cores, warm along the terminator
        vec3 cloudCol = vec3(0.96, 0.97, 1.0) * (0.03 + 1.15 * max(d, 0.0)) * lit;
        cloudCol *= mix(1.0, 0.78, smoothstep(0.6, 1.0, cl));
        // relief: tops facing the Sun brighter, the far flanks in their own shade
        cloudCol *= 0.78 + 0.44 * clamp((cl - shade) * 4.0 + 0.5, 0.0, 1.0);
        vec3 col = mix(ground, cloudCol, cl * 0.92);
        // the terminator warms what the low Sun lights, instead of painting a band on top
        col *= mix(vec3(1.0), vec3(1.35, 0.72, 0.45), term * lit);
        // night side: city lights under the clouds, faint blue form, clouds faintly visible
        float dark = 1.0 - lit;
        col += city * 1.3 * dark * (1.0 - cl * 0.85);
        col += (day * 0.008 + vec3(0.004, 0.007, 0.016) + vec3(0.01, 0.012, 0.02) * cl) * dark;
        // aerial haze only at the very limb, blue where the Sun is up
        float rim = pow(1.0 - max(dot(n, v), 0.0), 6.0);
        col += vec3(0.3, 0.55, 1.0) * rim * 0.55 * smoothstep(-0.1, 0.35, d);
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
