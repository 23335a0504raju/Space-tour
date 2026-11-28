import * as THREE from 'three';

/**
 * The cockpit's holographic globe (holo/HoloGlobe.tsx): the Earth as light. The continents are dots
 * taken from the day map, over fine lines of latitude and longitude, with a bright rim and a band
 * travelling down it. Additive, both sides (the far side shows faintly through). `uOpen` is the
 * story value (0 hidden, 1 full); `uTime` is ambient (seconds).
 */
export function createHoloGlobeMaterial(map: THREE.Texture, lite: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uOpen: { value: 1 },
      // straight to the screen, added light lands brighter than through the post pass
      uGain: { value: lite ? 0.42 : 0.72 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vToEye;
      varying float vHeight;
      void main() {
        vUv = uv;
        vHeight = normal.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalMatrix * normal;
        vToEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uOpen;
      uniform float uGain;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vToEye;
      varying float vHeight;

      const vec3 CYAN = vec3(0.05, 0.62, 1.0);
      const vec2 DOTS = vec2(150.0, 75.0);

      float grid(float x) {
        float d = abs(fract(x + 0.5) - 0.5);
        float soft = max(fwidth(x), 1e-4);
        return 1.0 - smoothstep(0.0, soft * 1.4, d);
      }

      void main() {
        float facing = abs(dot(normalize(vNormalView), normalize(vToEye)));
        float front = gl_FrontFacing ? 1.0 : 0.28;

        // one dot per cell, lit where the map shows land at the cell's centre (rows run top-down)
        vec2 cell = floor(vUv * DOTS);
        vec2 centre = (cell + 0.5) / DOTS;
        vec3 ground = textureLod(uMap, vec2(centre.x, 1.0 - centre.y), 1.0).rgb;
        float land = smoothstep(-0.004, 0.02, max(ground.r, ground.g) - ground.b * 0.92);
        float dot_ = 1.0 - smoothstep(0.22, 0.46, length(fract(vUv * DOTS) - 0.5));

        float lines = max(grid(vUv.x * 24.0), grid(vUv.y * 12.0));
        float rim = pow(1.0 - facing, 2.6);
        float sweep = exp(-pow((vHeight - (1.3 - fract(uTime * 0.18) * 2.6)) / 0.06, 2.0));

        vec3 light = CYAN * (0.035 + lines * 0.16 + rim * 0.75 + sweep * 0.22) +
          mix(CYAN * 0.1, vec3(0.55, 0.95, 1.0) * 1.15, land) * dot_;
        gl_FragColor = vec4(light * front * uGain * smoothstep(0.0, 0.4, uOpen), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.AdditiveBlending,
  });
}
