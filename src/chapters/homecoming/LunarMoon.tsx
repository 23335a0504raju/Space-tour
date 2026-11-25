import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getKTX2Loader } from '../../engine/assets/loaders.ts';
import { fovForAspect } from '../../engine/camera/shots.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useJourneyStore } from '../../engine/store.ts';
import {
  createDustMaterial,
  createDustUniforms,
  makeDust,
  makeRocks,
  MOON_RADIUS,
  RING_OUTER,
  rockAt,
  ROCKS,
} from '../../shaders/lunarRing.ts';
import type { JourneyFrame } from '../contract.ts';
import { FINAL_VIEW, MOON_ANCHOR, ringForm, rocksIn } from './homecoming.ts';

/** NASA SVS CGI Moon Kit (registered with SC06's Moon). */
const MOON_TEX = '/assets/textures/moon_1k.ktx2';
/** How far out the Moon hangs (well past the hull, far short of Earth). */
const DISTANCE = 80;
/** The ring's share of the anchor box's shorter side. */
const FILL = 0.92;
/** The ring is tipped back from facing the camera, so it reads as a wide ellipse (reference look). */
const TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0.12));
/** Grain size in the reference was 0.008 at 10.8 units from its camera; same on-screen fineness. */
const GRAIN = (0.008 * DISTANCE) / 10.8;

/** A box in viewport pixels, measured without CSS transforms (the card's entrance moves it). */
function layoutBox(el: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const pose = new THREE.PerspectiveCamera();
const ray = new THREE.Vector3();
const forward = new THREE.Vector3();
const rock = new THREE.Vector3();
const toDust = new THREE.Matrix4();
const dummy = new THREE.Object3D();

/**
 * SC13's Moon with its forming ring and rock belt, placed in the world so that from the chapter's
 * final camera it sits inside the contact card's right half. The camera lifts toward it; nothing
 * is pinned to the screen. Ring formation follows scroll (story state); drift is ambient.
 */
export function LunarMoon({ id, frame }: { id: string; frame: JourneyFrame }) {
  const gl = useThree((s) => s.gl);
  const low = useJourneyStore((s) => s.tier !== 'balanced');
  const map = useLoader(getKTX2Loader(gl), MOON_TEX);
  useLayoutEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }, [map]);

  const geometry = useMemo(() => {
    const dust = makeDust(low ? 24_000 : 60_000);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(dust.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(dust.colors, 3));
    g.setAttribute('aRandom', new THREE.BufferAttribute(dust.randoms, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RING_OUTER + 1.5);
    return g;
  }, [low]);
  const uniforms = useMemo(() => createDustUniforms(), []);
  const dustMaterial = useMemo(() => {
    const m = createDustMaterial(uniforms, !low);
    m.size = GRAIN;
    return m;
  }, [uniforms, low]);
  const moonMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        bumpMap: map,
        bumpScale: 0.02,
        roughness: 0.8,
        metalness: 0.1,
      }),
    [map],
  );
  const rockMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        bumpMap: map,
        bumpScale: 0.08,
        roughness: 0.7,
        metalness: 0.1,
      }),
    [map],
  );
  const rockGeometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const rocks = useMemo(() => makeRocks(ROCKS), []);
  useDisposeOnUnmount(geometry, dustMaterial, moonMaterial, rockMaterial, rockGeometry);

  const group = useRef<THREE.Group>(null);
  const moon = useRef<THREE.Mesh>(null);
  const dust = useRef<THREE.Points>(null);
  const belt = useRef<THREE.InstancedMesh>(null);

  // Place the group for the final view, from the anchor's layout box (on load and on resize only).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[${MOON_ANCHOR}]`);
    const g = group.current;
    if (!el || !g) return;
    const place = () => {
      const box = layoutBox(el);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (box.w < 40 || box.h < 40 || !w || !h) {
        g.visible = false; // narrow layouts drop the Moon column
        return;
      }
      g.visible = true;
      pose.fov = fovForAspect(FINAL_VIEW.fov, frame.aspect);
      pose.aspect = w / h;
      pose.near = 0.05;
      pose.far = 2000;
      pose.position.set(...FINAL_VIEW.position);
      pose.lookAt(...FINAL_VIEW.target);
      pose.updateProjectionMatrix();
      pose.updateMatrixWorld();
      const nx = ((box.x + box.w / 2) / w) * 2 - 1;
      const ny = -(((box.y + box.h / 2) / h) * 2 - 1);
      ray.set(nx, ny, 0.5).unproject(pose).sub(pose.position).normalize();
      g.position.copy(pose.position).addScaledVector(ray, DISTANCE);
      // world units per pixel at the Moon's depth
      const depth = DISTANCE * ray.dot(pose.getWorldDirection(forward));
      const perPx = (2 * depth * Math.tan(THREE.MathUtils.degToRad(pose.fov / 2))) / h;
      g.scale.setScalar((FILL * Math.min(box.w, box.h) * perPx) / (2 * RING_OUTER));
      g.quaternion.copy(pose.quaternion).multiply(TILT);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [frame]);

  useFrame(({ clock }) => {
    if (frame.id !== id) return;
    const time = clock.elapsedTime;
    // story: how far the ring has formed, and the belt's arrival
    uniforms.uProgress.value = ringForm(frame.t);
    const arrive = rocksIn(frame.t);
    // ambient: the Moon turns, the dust drifts and shimmers, the rocks orbit and tumble
    uniforms.uTime.value = time;
    if (moon.current) moon.current.rotation.y = time * 0.05;
    const d = dust.current;
    if (d) {
      d.rotation.set(-Math.PI / 2, -time * 0.02, 0);
      d.updateMatrix();
      toDust.copy(d.matrix).invert();
    }
    const b = belt.current;
    if (!b) return;
    b.visible = arrive > 0.01;
    const into = uniforms.uRocks.value;
    for (let i = 0; i < rocks.length; i += 1) {
      const r = rocks[i]!;
      rockAt(r, time, rock);
      if (b.visible) {
        dummy.position.copy(rock);
        dummy.rotation.set(
          r.rot[0] + r.spin[0] * time,
          r.rot[1] + r.spin[1] * time,
          r.rot[2] + r.spin[2] * time,
        );
        dummy.scale.setScalar(Math.max(r.scale * arrive, 1e-4));
        dummy.updateMatrix();
        b.setMatrixAt(i, dummy.matrix);
      }
      // where each rock is in the dust's own frame (the dust shader pushes grains away)
      rock.applyMatrix4(toDust);
      into[i * 4] = rock.x;
      into[i * 4 + 1] = rock.y;
      into[i * 4 + 2] = rock.z;
      into[i * 4 + 3] = r.scale * arrive;
    }
    b.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={moon} material={moonMaterial}>
        <sphereGeometry args={[MOON_RADIUS, 64, 48]} />
      </mesh>
      <points ref={dust} geometry={geometry} material={dustMaterial} frustumCulled={false} />
      <instancedMesh
        ref={belt}
        args={[rockGeometry, rockMaterial, ROCKS]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
