import * as THREE from 'three';

/**
 * Rocket exhaust plume: an open cone (nozzle at the top, y = 0 → -1), additive.
 *  - white-hot core at the nozzle → orange → transparent along the length;
 *  - soft edges from the view angle (no hard cone silhouette);
 *  - shock diamonds near sea level, fading as the plume expands in thin air;
 *  - flicker: ambient wall-clock noise only (never story meaning).
 * Intensities exceed 1 on purpose so Bloom (threshold 1) catches the core.
 * Reduced-cost path (Low tier): no noise octave loop, one flicker term.
 */
export interface PlumeUniforms {
  [name: string]: THREE.IUniform;
  uTime: THREE.IUniform<number>;
  uIntensity: THREE.IUniform<number>;
  uExpand: THREE.IUniform<number>;
  uLength: THREE.IUniform<number>;
}

const vertex = /* glsl */ `
  varying float vAlong;
  varying float vEdge;
  varying vec2 vAround;
  void main() {
    vAlong = -position.y; // 0 at the nozzle → 1 at the tail (geometry is unit length)
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 view = normalize(cameraPosition - world.xyz);
    vEdge = abs(dot(n, view));
    vAround = vec2(atan(position.z, position.x), position.y);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = (lowCost: boolean, outer: boolean) => /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uExpand;
  uniform float uLength;
  varying float vAlong;
  varying float vEdge;
  varying vec2 vAround;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float a = vAlong;
    // soft silhouette: transparent where the surface is seen edge-on
    float body = smoothstep(0.0, 0.55, vEdge);
    // length falloff
    float fade = pow(1.0 - a, 1.6);
    // shock diamonds (sea level only): bright knots along the first third
    float diamonds = (1.0 - uExpand) * smoothstep(0.35, 0.0, a) * pow(0.5 + 0.5 * cos(a * uLength * 2.4), 6.0);
    ${
      lowCost
        ? 'float flicker = 0.9 + 0.1 * sin(uTime * 37.0 + a * 20.0);'
        : `float flicker = 0.75 + 0.25 * noise(vec2(vAround.x * 3.0, a * 9.0 - uTime * 14.0))
                       + 0.12 * noise(vec2(vAround.x * 7.0, a * 23.0 - uTime * 31.0));`
    }
    // Colour stays saturated below ~1.2 except in the core: AgX turns anything much brighter
    // into white, which is what made the first version read as a pale tube.
    vec3 core = vec3(1.0, 0.92, 0.75);
    vec3 hot = vec3(1.0, 0.42, 0.07);
    vec3 tail = vec3(0.85, 0.17, 0.03);
    vec3 col = mix(core, hot, smoothstep(0.03, 0.18, a));
    col = mix(col, tail, smoothstep(0.3, 0.85, a));
    float k = uIntensity * pow(body, 1.5) * fade * flicker;
    // thin air: a fainter, wider, bluer plume
    col = mix(col, vec3(0.7, 0.75, 1.0), uExpand * 0.3);
    float gain = mix(4.0, 0.9, smoothstep(0.0, 0.2, a)) + 2.5 * diamonds;
    ${
      outer
        ? `// outer glow: a wide, dim, saturated orange envelope around the hot core
    col = mix(hot, tail, smoothstep(0.0, 0.7, a));
    // starts transparent at the nozzle (no disc) and has very soft sides
    k = uIntensity * pow(body, 3.0) * fade * flicker * smoothstep(0.0, 0.3, a);
    gain = 0.4;`
        : ''
    }
    vec3 outC = col * k * gain * (1.0 - 0.4 * uExpand);
    gl_FragColor = vec4(outC, 1.0);
  }
`;

/** `outer`: the wide orange envelope drawn around the core (second, larger mesh). */
export function createPlumeMaterial(lowCost: boolean, outer = false): THREE.ShaderMaterial {
  const uniforms: PlumeUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uExpand: { value: 0 },
    uLength: { value: 10 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment(lowCost, outer),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Unit plume geometry: nozzle radius 1 at y = 0, widening to 1.6 at y = -1. */
export function createPlumeGeometry(segments: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1.6, 1, segments, 12, true);
  g.translate(0, -0.5, 0);
  return g;
}
