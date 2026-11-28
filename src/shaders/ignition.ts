import * as THREE from 'three';

/**
 * The light round the cockpit's ignition button (cockpit/Ignition.tsx): arming rings lying on the
 * panel with a second, fainter set floating over them, and the label above. Additive. `uShow`,
 * `uArm` and `uFire` (0 to 1) are story values; `uTime` is ambient (seconds).
 */
const additive = {
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  forceSinglePass: true,
  blending: THREE.AdditiveBlending,
} as const;

const colours = /* glsl */ `
  const vec3 CYAN = vec3(0.05, 0.62, 1.0);
  const vec3 GOLD = vec3(1.0, 0.5, 0.08);
`;

/** For quads carrying `aLayer` (0 on the panel, 1 floating). */
export function createIgnitionRingMaterial() {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: {
      uTime: { value: 0 },
      uShow: { value: 0 },
      uArm: { value: 0 },
      uFire: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aLayer;
      varying vec2 vUv;
      varying float vLayer;
      void main() {
        vUv = uv;
        vLayer = aLayer;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vLayer;
      uniform float uTime;
      uniform float uShow;
      uniform float uArm;
      uniform float uFire;
      ${colours}

      float band(float r, float from, float to) {
        float soft = max(fwidth(r), 1e-4);
        return smoothstep(from - soft, from + soft, r) * (1.0 - smoothstep(to - soft, to + soft, r));
      }

      void main() {
        vec2 c = vUv - 0.5;
        // the rings open outward as they appear
        float r = length(c) / mix(0.55, 1.0, uShow);
        if (r > 0.5) discard;
        float turn = fract(atan(c.x, c.y) / 6.2832); // 0 at the top, clockwise
        vec3 colour = mix(CYAN, GOLD, smoothstep(0.75, 1.0, uArm));

        float ticks = band(r, 0.43, 0.462) * step(0.55, fract(turn * 60.0 + uTime * 0.35));
        float rim = band(r, 0.478, 0.485);
        float dashes = band(r, 0.3, 0.322) * step(0.4, fract(turn * 3.0 - uTime * 0.22));
        vec3 light;
        if (vLayer < 0.5) {
          // the arming arc fills as the safety cover lifts
          float arc = band(r, 0.36, 0.395);
          float filled = step(turn, uArm);
          float cells = step(0.12, fract(turn * 40.0));
          float inner = band(r, 0.232, 0.238);
          light = colour * (ticks * 0.8 + rim * 0.6 + dashes * 0.55 + inner * 0.5 +
            arc * cells * mix(0.12, 1.15, filled));
          // the press sends a ring of light outward
          float wave = mix(0.17, 0.5, uFire);
          light += GOLD * exp(-pow((r - wave) / 0.022, 2.0)) * (1.0 - uFire) *
            step(0.001, uFire) * 1.8;
          light += GOLD * (1.0 - smoothstep(0.1, 0.3, r)) * uFire * 0.35;
        } else {
          light = colour * (ticks * 0.16 + dashes * 0.2);
        }

        gl_FragColor = vec4(light * uShow, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The label: the atlas' upper half before the press, its lower half after it. */
export function createIgnitionLabelMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uShow: { value: 0 },
      uFire: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uShow;
      uniform float uFire;
      ${colours}

      void main() {
        // it unfolds from its middle
        if (abs(vUv.x - 0.5) > 0.5 * uShow) discard;
        float fired = step(0.001, uFire);
        vec2 at = vec2(vUv.x, 0.5 * vUv.y + 0.5 * (1.0 - fired));
        vec3 art = texture2D(uMap, at).rgb;
        float lines = 0.9 + 0.1 * cos((vUv.y * 40.0 - uTime * 2.0) * 6.2832);
        vec3 colour = mix(CYAN, GOLD, fired);
        // rules along the top and foot
        float rule = step(abs(abs(vUv.y - 0.5) - 0.46), 0.018);
        gl_FragColor = vec4(art * lines * 1.15 + colour * (rule * 0.7 + 0.035), 1.0);
        gl_FragColor.rgb *= uShow;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
