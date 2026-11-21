import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';

/**
 * The deep sky behind every space chapter (review 2026-11-21: "space should look like the reference
 * images, not plain"): the Milky Way band with a warm core and dark dust lanes, purple / blue /
 * magenta nebula clouds, and fine star dust. Procedural (0 bytes, no licence), and *baked once* into
 * an equirectangular texture the first time a space chapter mounts, so it costs one textured sphere
 * per frame. Sharp stars are drawn separately on top (Starfield), since a baked texel is magnified
 * about 2.5x on screen.
 *
 * The texture is shared by every chapter and lives for the session (one allocation: 32 MB on the
 * Balanced tier at 4096 x 2048, 8 MB otherwise). It is stored sRGB-encoded in 8 bits (less banding in
 * the darks than linear 8-bit) and decoded in the sky shader.
 */

/** Galactic plane normal and core direction (world). Shared with Starfield's star density. */
export const GALAXY = {
  // the band runs diagonally through the forward (-z) view most chapter cameras use
  normal: new THREE.Vector3(0.6, 0.8, 0.05).normalize(),
  core: new THREE.Vector3(0.3, -0.2, -0.93).normalize(),
} as const;

const bakeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const bakeFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uN;
  uniform vec3 uCore;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 7; i++) { v += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; }
    return v;
  }
  float ridged(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * (1.0 - abs(noise3(p) * 2.0 - 1.0)); p = p * 2.1 + vec3(3.1, 0.7, 5.3); a *= 0.5; }
    return v;
  }

  void main() {
    // equirectangular texel -> world direction (matches SphereGeometry's UV layout)
    float phi = vUv.x * 6.2831853;
    float theta = (1.0 - vUv.y) * 3.1415927;
    vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));

    // domain-warped coordinates: nebulae curl instead of looking like plain noise
    vec3 q = d * 2.2;
    vec3 w = vec3(fbm(q + 1.3), fbm(q + 7.9), fbm(q + 4.4));
    vec3 p = q + 1.6 * w;

    // the galactic band: its width breathes along its length
    float b = dot(d, uN);
    float width = 0.16 + 0.1 * fbm(d * 3.0 + 11.0);
    float band = exp(-b * b / (width * width));
    float core = exp(-pow(acos(clamp(dot(d, uCore), -1.0, 1.0)) / 0.32, 2.0));

    // nebula clouds: strongest in the band, with a few large clouds well away from it
    float n = fbm(p * 1.4);
    float clouds = smoothstep(0.5, 0.88, n);
    float far = smoothstep(0.68, 0.95, fbm(d * 1.3 + 31.0)) * 0.35;
    float neb = clouds * (band * 0.95 + far);

    // dark dust lanes cut through the bright band
    float lanes = smoothstep(0.5, 0.85, ridged(d * 5.5 + w * 1.4)) * band;

    vec3 deep = vec3(0.0025, 0.003, 0.009);
    vec3 blue = vec3(0.08, 0.2, 0.75);
    vec3 violet = vec3(0.34, 0.16, 0.58);
    vec3 magenta = vec3(0.75, 0.18, 0.5);
    vec3 warm = vec3(1.0, 0.72, 0.46);

    float hue = fbm(p * 0.8 + 21.0);
    vec3 nebCol = mix(blue, violet, smoothstep(0.35, 0.6, hue));
    nebCol = mix(nebCol, magenta, smoothstep(0.58, 0.78, hue) * 0.8);

    vec3 col = deep;
    // diffuse unresolved starlight of the band, warm toward the core
    // the band's unresolved starlight: cool violet-blue, warm only at the core
    float grain = fbm(p * 3.0);
    col += mix(vec3(0.13, 0.12, 0.3), warm * 0.5, core) * band * band * (0.15 + 0.85 * grain * grain) * 0.55;
    col += warm * core * core * band * 0.7 * (0.4 + 0.6 * n);
    col += nebCol * neb * neb * 1.6;
    col *= 1.0 - lanes * 0.92;

    // fine star dust: denser in the band (texel-sized points, the sharp stars are separate)
    vec3 cell = floor(d * 900.0);
    float h = hash3(cell);
    float dens = 0.985 - band * 0.03;
    col += vec3(0.85, 0.88, 1.0) * smoothstep(dens, 1.0, h) * (0.25 + 0.75 * band) * 0.55;

    col = max(col, 0.0);
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform sampler2D uSky;
  uniform float uGain;
  varying vec2 vUv;
  void main() {
    vec3 c = pow(texture2D(uSky, vUv).rgb, vec3(2.2)) * uGain;
    // half-step dither: the dark gradients would band on 8-bit displays
    float r = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    c += (r - 0.5) / 255.0;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const skyVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const baked = new Map<number, THREE.Texture>();

function bakeSky(gl: THREE.WebGLRenderer, width: number): THREE.Texture {
  const hit = baked.get(width);
  if (hit) return hit;
  const rt = new THREE.WebGLRenderTarget(width, width / 2, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  rt.texture.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.ShaderMaterial({
    vertexShader: bakeVertex,
    fragmentShader: bakeFragment,
    uniforms: { uN: { value: GALAXY.normal }, uCore: { value: GALAXY.core } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.render(scene, cam);
  gl.setRenderTarget(prev);
  quad.geometry.dispose();
  mat.dispose();
  baked.set(width, rt.texture);
  return rt.texture;
}

const SKY_RADIUS = 1900; // inside the 2 km far plane, behind every subject

export function DeepSky({
  rotation = 0,
  gain = 1,
}: {
  /** Turn about the vertical axis, so each chapter frames a different stretch of the sky. */
  rotation?: number;
  /** Overall brightness (1 = reference). */
  gain?: number;
}) {
  const gl = useThree((s) => s.gl);
  const balanced = useJourneyStore((s) => s.tier === 'balanced');
  const width = balanced ? 4096 : 2048;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: { uSky: { value: bakeSky(gl, width) }, uGain: { value: gain } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [gl, width, gain],
  );
  useDisposeOnUnmount(material);
  const group = useRef<THREE.Group>(null);
  // camera-centred: the sky is at infinity, so it never parallaxes
  useFrame(({ camera }) => group.current?.position.copy(camera.position));
  return (
    <group ref={group}>
      <mesh rotation={[0, rotation, 0]} material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
      </mesh>
    </group>
  );
}
