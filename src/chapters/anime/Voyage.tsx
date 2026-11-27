import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import type { JourneyFrame } from '../contract.ts';
import { shipZ } from './anime.ts';
import type { AreaId } from './anime.ts';
import { PAINTED_BLEND } from './parts.tsx';
import { seeded } from './layout.ts';
import {
  aheadPlanet,
  cloudCover,
  createPlanetState,
  leavingPlanet,
  spaceAt,
  voyageAt,
} from './voyage.ts';
import type { PlanetState, Voyage as VoyageState } from './voyage.ts';

/**
 * What is seen on the way between two worlds (voyage.ts): the planet being left, the planet ahead,
 * the stars as the air thins, and the star streaks of the crossing. Everything is a pure function
 * of the voyage parameter, so reverse scrolling is exact. All of it is painted (PAINTED_BLEND): the
 * style pass adds no ink and no posterising.
 */

/** One planet's colours (linear light: the style pass lifts painted pixels). */
interface Look {
  readonly sea: string;
  readonly land: string;
  readonly high: string;
  readonly cloud: string;
  readonly shade: string;
  readonly air: string;
  readonly seed: number;
}

/** Each world seen from space, in its own colours. */
export const PLANETS: Readonly<Record<AreaId, Look>> = {
  // the Hidden Leaf: forest and stone under a blue sky
  discipline: {
    sea: '#06306c',
    land: '#145218',
    high: '#4e5a14',
    cloud: '#c6d6ea',
    shade: '#3c4f88',
    air: '#4f9cf0',
    seed: 3.1,
  },
  // the frontier: desert, red rock and dust
  proof: {
    sea: '#5a2418',
    land: '#94501e',
    high: '#c4893c',
    cloud: '#dcc0a0',
    shade: '#6a4058',
    air: '#f08c50',
    seed: 11.7,
  },
  // the blossom valley at dusk
  horizon: {
    sea: '#1c1858',
    land: '#2c5c44',
    high: '#b03c78',
    cloud: '#d4bcdc',
    shade: '#44306e',
    air: '#a870f0',
    seed: 23.9,
  },
};

/**
 * Value noise from a small 3D texture: one fetch per octave. Computed noise made the planet shader
 * slow to compile, a visible hitch as the first world loaded (scripts/measure-freezes.ts).
 */
const NOISE_SIZE = 32;
let noiseTexture: THREE.Data3DTexture | null = null;
function planetNoise(): THREE.Data3DTexture {
  if (noiseTexture) return noiseTexture;
  const rand = seeded(53);
  const data = new Uint8Array(NOISE_SIZE ** 3);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.floor(rand() * 256);
  const t = new THREE.Data3DTexture(data, NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
  t.format = THREE.RedFormat;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return (noiseTexture = t);
}

const NOISE = /* glsl */ `
  uniform highp sampler3D uNoise;
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    // eased between the lattice points, so the linear fetch reads as smooth noise
    f = f * f * (3.0 - 2.0 * f);
    return texture(uNoise, (i + f + 0.5) / ${NOISE_SIZE}.0).r;
  }
  float fbm3(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < OCTAVES; i++) { s += a * n3(p); p = p * 2.07 + 11.3; a *= 0.5; }
    return s / (1.0 - a * 2.0);
  }`;

const PLANET_VERT = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = cameraPosition - w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const PLANET_FRAG = /* glsl */ `
  uniform vec3 uSea;
  uniform vec3 uLand;
  uniform vec3 uHigh;
  uniform vec3 uCloud;
  uniform vec3 uShade;
  uniform vec3 uAir;
  uniform vec3 uSun;
  uniform float uSeed;
  uniform float uCover;
  varying vec3 vObj;
  varying vec3 vN;
  varying vec3 vV;
  ${NOISE}
  void main() {
    vec3 p = vObj + uSeed;
    // continents, with crisp painted coasts
    float ground = fbm3(p * 2.3);
    float rock = fbm3(p * 6.5 + 4.0);
    vec3 col = mix(uSea, uLand, smoothstep(0.49, 0.515, ground));
    col = mix(col, uHigh, smoothstep(0.53, 0.56, rock) * smoothstep(0.5, 0.56, ground));
    col *= 0.9 + 0.22 * smoothstep(0.35, 0.65, fbm3(p * 17.0));
    // cloud bands drawn out along the equator; a full deck while the planet is under the ship
    vec3 stretched = p * vec3(5.0, 11.0, 5.0);
    float broad = fbm3(stretched + 2.0 * fbm3(p * 4.0));
    // the small puffs belong to the close view: on a far globe they would only shimmer
    float puffs = mix(0.5, fbm3(p * 46.0 + broad), max(uCover, 0.2));
    float cloud = broad + (puffs - 0.5) * mix(0.18, 0.5, uCover);
    // under the ship the deck is broken, so the land shows between the clouds
    float edge = mix(0.58, 0.43, uCover);
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    // two painted cloud tones: lit crowns over cool hollows
    vec3 deck = mix(mix(uCloud, uShade, 0.62), uCloud, smoothstep(0.4, 0.62, puffs));
    col = mix(col, deck, smoothstep(edge, edge + 0.06, cloud));
    // cel light: a lit side, a soft terminator, a cool night side that never goes black
    float d = dot(n, uSun);
    float lit = smoothstep(-0.12, 0.22, d);
    col = mix(col * uShade * 0.55, col, lit);
    // the air: a coloured rim, strongest towards the limb
    float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.4);
    col = mix(col, uAir * (0.35 + 0.65 * lit), rim * 0.72);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** The soft halo of air round a globe: a shell seen from inside out, strongest at the limb. */
const HALO = 1.1;
const HALO_VERT = /* glsl */ `
  varying vec3 vW;
  varying vec3 vC;
  varying float vR;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vC = modelMatrix[3].xyz;
    vR = length(modelMatrix[0].xyz) / ${HALO.toFixed(2)};
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const HALO_FRAG = /* glsl */ `
  uniform vec3 uAir;
  varying vec3 vW;
  varying vec3 vC;
  varying float vR;
  void main() {
    vec3 ray = normalize(vW - cameraPosition);
    vec3 to = vC - cameraPosition;
    // how close the view ray passes to the planet's centre, in radii
    float d = length(to - ray * dot(to, ray)) / vR;
    float a = (1.0 - smoothstep(1.0, ${HALO.toFixed(2)}, d)) * step(0.995, d);
    // gone when the camera is down in the air itself
    a *= smoothstep(1.2, 1.6, length(to) / vR);
    if (a < 0.003) discard;
    gl_FragColor = vec4(uAir, a * a * 0.7);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const SUN = new THREE.Vector3(0.45, 0.55, 0.7).normalize();

function Planet({
  look,
  state,
  spin,
}: {
  look: Look;
  state: { readonly current: PlanetState };
  spin: { readonly current: number };
}) {
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, low ? 72 : 112, low ? 48 : 72), [low]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: { OCTAVES: low ? 3 : 4 },
        uniforms: {
          uSea: { value: new THREE.Color(look.sea) },
          uLand: { value: new THREE.Color(look.land) },
          uHigh: { value: new THREE.Color(look.high) },
          uCloud: { value: new THREE.Color(look.cloud) },
          uShade: { value: new THREE.Color(look.shade) },
          uAir: { value: new THREE.Color(look.air) },
          uSun: { value: SUN },
          uSeed: { value: look.seed },
          uCover: { value: 0 },
          uNoise: { value: planetNoise() },
        },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        ...PAINTED_BLEND,
        // a solid body: drawn with the scenery, so it hides what is behind it
        transparent: false,
      }),
    [look, low],
  );
  const halo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uAir: { value: new THREE.Color(look.air) } },
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        ...PAINTED_BLEND,
      }),
    [look],
  );
  useDisposeOnUnmount(geo, mat, halo);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = state.current;
    g.visible = p.visible;
    if (!p.visible) return;
    g.position.set(p.x, p.y, p.z);
    g.scale.setScalar(p.radius);
    if (body.current) body.current.rotation.set(0.35, spin.current, 0.12);
    mat.uniforms['uCover']!.value = cloudCover(p.radius);
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={body} geometry={geo} material={mat} frustumCulled={false} />
      <mesh geometry={geo} material={halo} scale={HALO} renderOrder={-7} frustumCulled={false} />
    </group>
  );
}

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  uniform float uPixel;
  void main() {
    gl_PointSize = aSize * uPixel;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const STAR_FRAG = /* glsl */ `
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.5, 1.0, d)) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.85, 0.88, 1.0, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Streaks: each a segment along the flight line, carried past the ship as the voyage advances. */
const STREAK_SPAN = 420;
const STREAK_VERT = /* glsl */ `
  attribute float aEnd;
  uniform float uTravel;
  uniform float uLength;
  varying float vEnd;
  void main() {
    vec3 p = position;
    // wraps in a box from far ahead (-z) to just behind the ship
    p.z = mod(p.z + uTravel, ${STREAK_SPAN.toFixed(1)}) - ${(STREAK_SPAN - 80).toFixed(1)};
    p.z -= aEnd * uLength;
    vEnd = aEnd;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const STREAK_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vEnd;
  void main() {
    gl_FragColor = vec4(0.72, 0.78, 1.0, uOpacity * (1.0 - vEnd));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function Stars({ space, travel }: { space: Ref01; travel: Ref01 }) {
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const points = useRef<THREE.Points>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const stars = useMemo(() => {
    const rand = seeded(97);
    const n = low ? 450 : 900;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      pos.set([Math.cos(a) * r * 1140, z * 1140, Math.sin(a) * r * 1140], i * 3);
      size[i] = rand() < 0.06 ? 4 + rand() * 2 : 1.4 + rand() * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    return g;
  }, [low]);
  const streaks = useMemo(() => {
    const rand = seeded(131);
    const n = low ? 60 : 130;
    const pos = new Float32Array(n * 6);
    const end = new Float32Array(n * 2);
    for (let i = 0; i < n; i += 1) {
      const a = rand() * Math.PI * 2;
      // clear of the ship, spread out to the edges of the view
      const r = 24 + rand() * 110;
      const p = [Math.cos(a) * r, Math.sin(a) * r * 0.7 + 6, rand() * STREAK_SPAN];
      pos.set([...p, ...p], i * 6);
      end.set([0, 1], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    return g;
  }, [low]);
  const starMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uPixel: { value: 1 } },
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        depthWrite: false,
        ...PAINTED_BLEND,
      }),
    [],
  );
  const streakMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uTravel: { value: 0 }, uLength: { value: 0 } },
        vertexShader: STREAK_VERT,
        fragmentShader: STREAK_FRAG,
        depthWrite: false,
        ...PAINTED_BLEND,
      }),
    [],
  );
  useDisposeOnUnmount(stars, streaks, starMat, streakMat);
  useFrame(({ gl }) => {
    const s = space.current;
    if (points.current) points.current.visible = s > 0.002;
    if (lines.current) lines.current.visible = s > 0.002;
    if (s <= 0.002) return;
    starMat.uniforms['uOpacity']!.value = s;
    starMat.uniforms['uPixel']!.value = gl.getPixelRatio();
    streakMat.uniforms['uOpacity']!.value = s * s * s * 0.55;
    streakMat.uniforms['uTravel']!.value = travel.current * 1900;
    // at speed the points draw out into lines
    streakMat.uniforms['uLength']!.value = 4 + 46 * s * s;
  });
  return (
    <>
      <points
        ref={points}
        geometry={stars}
        material={starMat}
        renderOrder={-9.5}
        frustumCulled={false}
        visible={false}
      />
      <lineSegments
        ref={lines}
        geometry={streaks}
        material={streakMat}
        frustumCulled={false}
        visible={false}
      />
    </>
  );
}

type Ref01 = { readonly current: number };

/** The planets and stars of one chapter's voyages, travelling with the ship. */
export function VoyageSky({
  area,
  previous,
  next,
  frame,
  id,
}: {
  area: AreaId;
  previous: AreaId | undefined;
  next: AreaId | undefined;
  frame: JourneyFrame;
  id: string;
}) {
  const group = useRef<THREE.Group>(null);
  const space = useMemo(() => ({ current: 0 }), []);
  const travel = useMemo(() => ({ current: 0 }), []);
  const spin = useMemo(() => ({ current: 0 }), []);
  const leaving = useMemo(() => ({ current: createPlanetState() }), []);
  const ahead = useMemo(() => ({ current: createPlanetState() }), []);
  // which two worlds the planets are, by join: this chapter leaves `area` or arrives at it
  const pair = useRef<'in' | 'out'>(previous ? 'in' : 'out');
  const arriving = useRef<THREE.Group>(null);
  const leavingOut = useRef<THREE.Group>(null);
  useFrame(() => {
    if (frame.id !== id) return;
    group.current?.position.set(0, 0, shipZ(frame.t));
    const v: VoyageState | null = voyageAt(area, frame.t);
    space.current = spaceAt(v);
    if (!v) {
      leaving.current.visible = false;
      ahead.current.visible = false;
      return;
    }
    pair.current = frame.t < 0.5 ? 'in' : 'out';
    travel.current = v.u;
    spin.current = v.u * 0.9;
    leavingPlanet(v.u, leaving.current);
    aheadPlanet(v.u, ahead.current);
    if (arriving.current) arriving.current.visible = pair.current === 'in';
    if (leavingOut.current) leavingOut.current.visible = pair.current === 'out';
  });
  return (
    <group ref={group}>
      <Stars space={space} travel={travel} />
      {previous && (
        <group ref={arriving} visible={false}>
          <Planet look={PLANETS[previous]} state={leaving} spin={spin} />
          <Planet look={PLANETS[area]} state={ahead} spin={spin} />
        </group>
      )}
      {next && (
        <group ref={leavingOut} visible={false}>
          <Planet look={PLANETS[area]} state={leaving} spin={spin} />
          <Planet look={PLANETS[next]} state={ahead} spin={spin} />
        </group>
      )}
    </group>
  );
}
