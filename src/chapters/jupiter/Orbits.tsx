import { useMemo } from 'react';
import * as THREE from 'three';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { JUPITER } from './jupiter.ts';

/**
 * Orbits for the project satellites (review 2026-11-21: "satellites in proper order, like the
 * reference"): each craft rides its own orbit around Jupiter, the orbits share a similar tilt so the
 * arcs nest, and each leaves a light trail behind it. Every orbit is built to pass exactly through its
 * station, so the camera keys and the overlay rest points are untouched. Static geometry, three
 * draw calls per orbit (faint full ring, trail, soft trail halo).
 */

/** The tilt the orbits lean toward (each one is the closest plane to it that holds its station). */
const PLANE = new THREE.Vector3(0.22, 0.92, 0.32).normalize();
/** Length of each trail behind its craft (radians of orbit). */
const TRAIL = 1.15;

export interface Orbit {
  readonly centre: THREE.Vector3;
  readonly radius: number;
  /** orthonormal basis of the orbit plane: u points at the station, v along the motion */
  readonly u: THREE.Vector3;
  readonly v: THREE.Vector3;
}

export function orbitThrough(station: readonly [number, number, number]): Orbit {
  const centre = new THREE.Vector3(...JUPITER.position);
  const r = new THREE.Vector3(...station).sub(centre);
  const radius = r.length();
  const u = r.clone().normalize();
  const n = PLANE.clone().addScaledVector(u, -PLANE.dot(u)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { centre, radius, u, v };
}

export const orbitPoint = (o: Orbit, a: number, out = new THREE.Vector3()) =>
  out
    .copy(o.centre)
    .addScaledVector(o.u, Math.cos(a) * o.radius)
    .addScaledVector(o.v, Math.sin(a) * o.radius);

/** Rotation that turns a craft to fly along its orbit at the station (+z along the motion). */
export function alongOrbit(o: Orbit): THREE.Euler {
  const m = new THREE.Matrix4().makeBasis(
    o.u.clone(),
    new THREE.Vector3().crossVectors(o.v, o.u),
    o.v.clone(),
  );
  return new THREE.Euler().setFromRotationMatrix(m);
}

function arcGeometry(o: Orbit, from: number, to: number, radius: number, segments: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1)
    pts.push(orbitPoint(o, from + ((to - from) * i) / segments));
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segments, radius, 6, false);
}

const trailVertex = /* glsl */ `
  varying float vAlong;
  void main() {
    vAlong = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const trailFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlong;
  void main() {
    // tail (0) → craft (1): fades in toward the craft, with a short taper right at the craft
    float a = pow(vAlong, 2.2) * smoothstep(1.0, 0.97, vAlong) * uStrength;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

function trailMaterial(color: string, strength: number) {
  return new THREE.ShaderMaterial({
    vertexShader: trailVertex,
    fragmentShader: trailFragment,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function OrbitTrail({ station }: { station: readonly [number, number, number] }) {
  const { ring, trail, halo, ringMat, trailMat, haloMat } = useMemo(() => {
    const o = orbitThrough(station);
    return {
      ring: arcGeometry(o, 0, Math.PI * 2, 0.07, 360),
      // the craft moves toward +angle; the trail lies behind it
      trail: arcGeometry(o, -TRAIL, -0.012, 0.13, 160),
      halo: arcGeometry(o, -TRAIL * 0.7, -0.012, 0.6, 120),
      ringMat: new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.32, 0.45, 0.7),
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      trailMat: trailMaterial('#dbe8ff', 1.2),
      haloMat: trailMaterial('#7aa6ff', 0.16),
    };
  }, [station]);
  useDisposeOnUnmount(ring, trail, halo, ringMat, trailMat, haloMat);
  return (
    <group>
      <mesh geometry={ring} material={ringMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={halo} material={haloMat} frustumCulled={false} renderOrder={3} />
      <mesh geometry={trail} material={trailMat} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
