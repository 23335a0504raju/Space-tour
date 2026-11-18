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
    },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform float uLow;
      varying vec3 vN; varying vec2 vUv; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN);
        float d = dot(n, uSun);
        vec2 uvf = vec2(vUv.x, 1.0 - vUv.y); // KTX2 is not Y-flipped
        vec3 day = texture2D(uDay, uvf).rgb;
        vec3 nightRaw = texture2D(uNight, uvf).rgb;
        // the map's dark land is blue; city lights are warm: key on red-over-blue
        float warm = max(nightRaw.r - nightRaw.b * 0.9, 0.0);
        vec3 night = vec3(1.0, 0.8, 0.5) * smoothstep(0.07, 0.4, warm);
        float lit = smoothstep(-0.06, 0.22, d);
        // ocean glint: a soft specular on dark blue water
        vec3 h = normalize(uSun + vV);
        float spec = pow(max(dot(n,h),0.0), 140.0) * smoothstep(0.0,0.3,d);
        float water = smoothstep(0.25, 0.0, day.r - day.b * 0.4);
        vec3 col = day * (0.03 + 1.25 * max(d,0.0)) * lit;
        col += day * 0.004 * (1.0 - lit);                       // faint earthshine
        col += night * 1.3 * (1.0 - lit);   // city lights
        col += vec3(0.8,0.9,1.0) * spec * water * 0.35 * (1.0 - uLow);
        // warm band along the terminator
        float term = exp(-pow(d / 0.06, 2.0));
        col += vec3(0.9,0.38,0.12) * term * 0.035;
        gl_FragColor = vec4(col, 1.0);
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
