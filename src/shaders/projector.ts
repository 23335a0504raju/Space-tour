import * as THREE from 'three';

/**
 * The light of the desk's hologram projector (room/Hologram.tsx): the lit emitter and the light it
 * spills, the soft beam up into the figure, and a few motes drifting in it. All additive, no
 * textures; `uTime` is ambient (seconds).
 */

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

/** A flat quad `size` metres across, laid on top of the puck. `gain` scales its light. */
export function createEmitterMaterial(size: number, gain: number) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTime: { value: 0 }, uSize: { value: size }, uGain: { value: gain } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      uniform float uSize;
      void main() {
        vPos = (uv - 0.5) * uSize; // metres from the projector's axis
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vPos;
      uniform float uTime;
      uniform float uSize;
      uniform float uGain;

      float circle(float r, float at, float width) {
        float d = (r - at) / width;
        return exp(-d * d);
      }

      void main() {
        float r = length(vPos);
        float turn = atan(vPos.y, vPos.x) / 6.2832;
        float breathe = 0.9 + 0.1 * sin(uTime * 2.2);
        float core = circle(r, 0.0, 0.03) * 0.9;
        float ring = circle(r, 0.054, 0.0038) * 2.4 * breathe;
        // a turning ring of dashes, then a pulse that travels outward and dies
        float dashes = circle(r, 0.069, 0.0022) * step(0.45, fract(turn * 22.0 + uTime * 0.2)) * 1.3;
        float k = fract(uTime * 0.42);
        float pulse = circle(r, mix(0.072, 0.165, k), 0.0035) * (1.0 - k) * (1.0 - k);
        float spill = exp(-r / 0.045) * 0.3 * (1.0 - smoothstep(0.35, 0.5, r / uSize));
        vec3 colour = vec3(0.08, 0.62, 1.0) * (ring + dashes + pulse + spill) +
          vec3(0.55, 0.92, 1.0) * (core + ring * 0.25);
        gl_FragColor = vec4(colour * uGain, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** For an open cone from the emitter up into the figure (uv.y 0 at the bottom). */
export function createBeamMaterial(gain: number) {
  return new THREE.ShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    uniforms: { uTime: { value: 0 }, uGain: { value: gain } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vToEye;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalMatrix * normal;
        vToEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vToEye;
      uniform float uTime;
      uniform float uGain;
      void main() {
        // soft like lit air: strongest where we look through most of it, gone at the silhouette
        float facing = abs(dot(normalize(vNormalView), normalize(vToEye)));
        float body = pow(facing, 1.6);
        float a = vUv.x * 6.2832;
        float rays = 0.72 + 0.28 * sin(a * 17.0 + uTime * 0.8) * sin(a * 7.0 - uTime * 1.3);
        float rise = smoothstep(0.86, 1.0, fract(vUv.y * 3.0 - uTime * 0.55)) * 0.5;
        float up = pow(1.0 - vUv.y, 1.7);
        float light = body * (up * rays * 0.5 + rise * (1.0 - vUv.y) * 0.45);
        gl_FragColor = vec4(vec3(0.06, 0.55, 1.0) * light * uGain, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Seeds for `count` motes (deterministic: the same dust every visit). */
export function moteGeometry(count: number): THREE.BufferGeometry {
  const seed = new Float32Array(count * 4);
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < seed.length; i += 1) seed[i] = hash(i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  return g;
}

/** `uHeight` is the drawing buffer's height in pixels (point sizes are in metres). */
export function createMoteMaterial() {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTime: { value: 0 }, uHeight: { value: 900 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uHeight;
      varying float vGlow;
      void main() {
        float life = fract(aSeed.w + uTime * (0.045 + 0.07 * aSeed.z));
        float spread = mix(0.04, 0.25, smoothstep(0.0, 0.55, life)) * (0.45 + 0.55 * aSeed.y);
        float a = aSeed.x * 6.2832 + uTime * (aSeed.z - 0.5) * 0.5;
        vec3 p = vec3(cos(a) * spread, 0.035 + life * 0.6, sin(a) * spread * 0.7);
        vGlow = sin(life * 3.1416) * (0.65 + 0.35 * sin(uTime * 3.0 + aSeed.x * 40.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float size = 0.007 + 0.007 * aSeed.y;
        gl_PointSize = size * projectionMatrix[1][1] * uHeight * 0.5 / gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vGlow;
      void main() {
        float dot_ = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(0.3, 0.8, 1.0) * dot_ * vGlow, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
