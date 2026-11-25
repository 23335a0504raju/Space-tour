import * as THREE from 'three';

/**
 * SC13's lunar ring (after the "Lunar Gravity" card the user supplied, 2026-11-25): a disc of fine
 * dust around the Moon that sweeps into being from the Moon's surface, and a belt of tumbling
 * rocks that push the dust aside as they pass.
 *
 * Units are the reference's (Moon radius 2, dust 2.2–4.4 out); the scene scales the whole group.
 * Everything is seeded, so the ring is the same on every load. How far the ring has formed
 * (`uProgress`) is story state set from scroll progress; the drift, shimmer and rock orbits are
 * ambient (clock time).
 */
export const MOON_RADIUS = 2;
/** Outer edge of the dust (what the scene fits to the card). */
export const RING_OUTER = 4.4;
export const ROCKS = 75;

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Site palette: mostly cool grey dust, some cyan, a little of the gold accent (was purple). */
const PALETTE: readonly (readonly [number, number, number, number])[] = [
  [0.8, 0.25, 0.3, 0.35],
  [0.92, 0.0, 0.6, 0.8],
  [1, 0.84, 0.6, 0.3],
];

export interface RingDust {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly randoms: Float32Array;
}

/** The dust disc in the ring's own plane (x/z, thickness along y). */
export function makeDust(count: number): RingDust {
  const r = seeded(20261125);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const randoms = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = r() * Math.PI * 2;
    const rDist = r() ** 1.5;
    const radius = MOON_RADIUS * 1.1 + rDist * (RING_OUTER - MOON_RADIUS * 1.1);
    const thickness = 0.4 - rDist * 0.2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = (r() + r() + r() - 1.5) * thickness;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    const pick = r();
    const [, br, bg, bb] = PALETTE.find((p) => pick < p[0]) ?? PALETTE[0]!;
    const intensity = 1 - rDist;
    const sparkle = r() > 0.95 ? 2.5 : 1;
    const jitter = () => (r() - 0.5) * 0.1;
    const k = intensity * sparkle;
    colors[i * 3] = Math.min(1, Math.max(0, br + jitter())) * k;
    colors[i * 3 + 1] = Math.min(1, Math.max(0, bg + jitter())) * k;
    colors[i * 3 + 2] = Math.min(1, Math.max(0, bb + jitter())) * k;
    randoms[i] = r();
  }
  return { positions, colors, randoms };
}

export interface Rock {
  readonly angle: number;
  readonly baseRadius: number;
  readonly radialAmplitude: number;
  readonly radialSpeed: number;
  readonly phase: number;
  readonly z: number;
  readonly speed: number;
  readonly rot: readonly [number, number, number];
  readonly spin: readonly [number, number, number];
  readonly scale: number;
}

/** The rock belt, largest first (the dust only feels the rocks it is given). */
export function makeRocks(count: number): Rock[] {
  const r = seeded(7781);
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i += 1) {
    rocks.push({
      angle: r() * Math.PI * 2,
      baseRadius: 2.8 + r() * 2,
      radialAmplitude: 0.5 + r() * 1.5,
      radialSpeed: 0.15 + r() * 0.25,
      phase: r() * Math.PI * 2,
      z: (r() - 0.5) * 0.8,
      speed: (0.04 + r() * 0.08) * (r() > 0.5 ? 1 : -1),
      rot: [r() * Math.PI, r() * Math.PI, r() * Math.PI],
      // the reference turned rocks a fixed step per frame; per second at 60 fps
      spin: [(r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3],
      scale: 0.02 + r() ** 4 * 0.18,
    });
  }
  return rocks.sort((a, b) => b.scale - a.scale);
}

/**
 * A rock's place at clock time `time` (s), in the ring group's x/y plane; never inside the Moon.
 * Pure: the same time always gives the same place, so scrubbing never drifts.
 */
export function rockAt(rock: Rock, time: number, out: THREE.Vector3): THREE.Vector3 {
  const angle = rock.angle + rock.speed * time;
  let radius =
    rock.baseRadius + Math.sin(rock.phase + rock.radialSpeed * time) * rock.radialAmplitude;
  const floor = MOON_RADIUS * 1.075;
  if (radius < floor) radius = floor + (floor - radius) * 0.85;
  return out.set(Math.cos(angle) * radius, Math.sin(angle) * radius, rock.z);
}

export interface DustUniforms {
  readonly uProgress: THREE.IUniform<number>;
  readonly uRocks: THREE.IUniform<Float32Array>;
  readonly uTime: THREE.IUniform<number>;
}

export function createDustUniforms(): DustUniforms {
  return {
    uProgress: { value: 0 },
    uRocks: { value: new Float32Array(ROCKS * 4) },
    uTime: { value: 0 },
  };
}

/**
 * The dust material: additive points whose vertex shader sweeps each grain out of the Moon's
 * surface by angle as `uProgress` runs 0 → 1, and (`push`, Balanced only) lets rocks shove it.
 */
export function createDustMaterial(uniforms: DustUniforms, push: boolean): THREE.PointsMaterial {
  const m = new THREE.PointsMaterial({
    size: 0.008,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = /* glsl */ `
      uniform float uProgress;
      uniform vec4 uRocks[${ROCKS}];
      uniform float uTime;
      attribute float aRandom;
      varying float vProgress;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      vec3 transformed = vec3(position);
      float angle = atan(transformed.x, transformed.z);
      float spawn = 1.0 - abs(angle) / 3.14159265359;
      float grain = smoothstep(0.0, 0.4, uProgress * 1.4 - spawn);
      vProgress = grain;
      transformed.y += sin(angle * 10.0 + uTime) * 0.05 * aRandom;
      ${
        push
          ? /* glsl */ `
      if (uProgress > 0.5) {
        for (int i = 0; i < ${ROCKS}; i++) {
          vec4 rock = uRocks[i];
          vec3 away = transformed - rock.xyz;
          float dist = length(away);
          float reach = rock.w * 2.0 + 0.15;
          if (dist < reach) {
            float force = pow((reach - dist) / reach, 2.0);
            transformed += normalize(away) * force * 0.4;
            transformed.y += force * 0.2 * (aRandom - 0.5);
          }
        }
      }`
          : ''
      }
      float swirl = (1.0 - grain) * 4.0;
      float s = sin(swirl);
      float c = cos(swirl);
      transformed.xz = mat2(c, -s, s, c) * transformed.xz;
      transformed.y += (1.0 - grain) * (transformed.y >= 0.0 ? 1.0 : -1.0);
      transformed = mix(normalize(transformed) * ${(MOON_RADIUS * 1.05).toFixed(2)}, transformed, grain);
      `,
    );
    shader.fragmentShader = /* glsl */ `
      varying float vProgress;
      ${shader.fragmentShader}
    `.replace(
      '#include <color_fragment>',
      /* glsl */ `
      #include <color_fragment>
      diffuseColor.a *= vProgress;
      `,
    );
  };
  // one program per variant, not per closure
  m.customProgramCacheKey = () => `lunar-dust-${push ? 'push' : 'plain'}`;
  return m;
}
