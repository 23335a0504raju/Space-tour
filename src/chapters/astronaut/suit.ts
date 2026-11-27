import * as THREE from 'three';

/**
 * The astronaut's flight suit, built in code on the Mixamo Y Bot (which has no UVs and looks like
 * a jointed mannequin). P3 review: "the suit is not proper, not like a real suit; make it clear".
 *
 * Target look (PROJECT_VISION.md: modern fitted IVA pressure suit, SpaceX/Starliner style, not a
 * bulky EVA suit; faceless gold visor, decision C23):
 *  - Off-white fabric with a soft cloth sheen; the mannequin's dark joint rings become light-grey
 *    suit bellows instead of robot joints.
 *  - Colour zones from the skin weights (no UVs needed): charcoal gloves, boots and shoulder yokes.
 *  - The whole body inflated ~1 cm along its normals in the vertex shader, so it reads as a suit
 *    worn over a body rather than a slim figure.
 *  - Hardware: a pressure helmet (shell, visor frame, gold visor, side hinges, neck seal), a suit
 *    collar, wrist disconnect rings, a thigh umbilical connector and a shoulder mission patch.
 *    Placed by raycasting the real body surface in the bind pose, then parented to bones.
 */

// ── Palette (sRGB) ────────────────────────────────────────────────────────────
const C = {
  fabric: '#ecebe6',
  bellows: '#c4c7cc',
  glove: '#23262c',
  boot: '#2a2d33',
  yoke: '#3a3e46',
} as const;

/** Inflation in model-local units, set once the model's unit size is known (shared uniform). */
const inflate = { value: 0 };

function suitMaterial(): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', // colours come from the vertex colour zones
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    // a soft cloth rim; kept low so the charcoal gloves and boots stay dark
    sheen: 0.3,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#d9d9d9'),
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInflate = inflate;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uInflate;\nattribute vec3 inflateDir;',
      )
      // bind-space offset along the smoothed bind-space normal, before skinning. The Y Bot is
      // flat-shaded (split normals), so offsetting along `normal` would crack every hard edge.
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed += inflateDir * uInflate;',
      );
  };
  m.customProgramCacheKey = () => 'astronaut-suit';
  return m;
}

export const SUIT = suitMaterial();
const SHELL = new THREE.MeshPhysicalMaterial({
  color: '#f2f1ec',
  roughness: 0.28,
  metalness: 0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2,
});
const TRIM = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.45, metalness: 0.55 });
const METAL = new THREE.MeshStandardMaterial({ color: '#8d939c', roughness: 0.3, metalness: 0.9 });
const VISOR = new THREE.MeshStandardMaterial({ color: '#d9a650', roughness: 0.06, metalness: 1 });
const PATCH = new THREE.MeshStandardMaterial({ color: '#1c2b4a', roughness: 0.7, metalness: 0 });
const PATCH_RIM = new THREE.MeshStandardMaterial({
  color: '#c99a45',
  roughness: 0.4,
  metalness: 0.7,
});

// ── Colour zones from skin weights ──────────────────────────────────────────────
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function paintZones(mesh: THREE.SkinnedMesh, joints: boolean): void {
  const g = mesh.geometry;
  if (g.getAttribute('color')) return; // geometry is shared between clones: paint once
  const idx = g.getAttribute('skinIndex');
  const wt = g.getAttribute('skinWeight');
  const bones = mesh.skeleton.bones;
  const zone = bones.map((b) =>
    /Hand/.test(b.name) ? 1 : /Foot|Toe/.test(b.name) ? 2 : /Shoulder/.test(b.name) ? 3 : 0,
  );
  const base = new THREE.Color(joints ? C.bellows : C.fabric);
  const glove = new THREE.Color(C.glove);
  const boot = new THREE.Color(C.boot);
  const yoke = new THREE.Color(C.yoke);
  const out = new Float32Array(idx.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < idx.count; i += 1) {
    const w = [0, 0, 0, 0];
    for (let k = 0; k < 4; k += 1) {
      const z = zone[idx.getComponent(i, k)] ?? 0;
      w[z] = (w[z] ?? 0) + wt.getComponent(i, k);
    }
    c.copy(base);
    c.lerp(yoke, smoothstep(0.45, 0.7, w[3] ?? 0));
    c.lerp(boot, smoothstep(0.3, 0.55, w[2] ?? 0));
    c.lerp(glove, smoothstep(0.3, 0.55, w[1] ?? 0));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  g.setAttribute('inflateDir', smoothNormals(g));
}

/** Per-vertex normal averaged over all vertices sharing a position (welds the split normals). */
function smoothNormals(g: THREE.BufferGeometry): THREE.BufferAttribute {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const sums = new Map<string, THREE.Vector3>();
  const keys: string[] = new Array<string>(pos.count);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    keys[i] = key;
    n.fromBufferAttribute(nrm, i).normalize();
    const s = sums.get(key);
    if (s) s.add(n);
    else sums.set(key, n.clone());
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const s = sums.get(keys[i] ?? '');
    if (!s) continue;
    n.copy(s).normalize();
    out[i * 3] = n.x;
    out[i * 3 + 1] = n.y;
    out[i * 3 + 2] = n.z;
  }
  return new THREE.BufferAttribute(out, 3);
}

// ── Surface probing (bind pose) ────────────────────────────────────────────────
interface Probe {
  readonly point: THREE.Vector3;
  readonly normal: THREE.Vector3;
}

/**
 * Probe results per body geometry. Every clone stands in the same bind pose, so the answers never
 * change, and finding them costs about 90 ms of raycasting against the skinned mesh: each chapter
 * that mounted an astronaut (SC02, SC03, SC04) froze the stand-up for that long.
 */
const probed = new WeakMap<THREE.BufferGeometry, Map<string, Probe>>();

function probe(
  surface: THREE.SkinnedMesh,
  from: THREE.Vector3,
  dir: THREE.Vector3,
  fallback: Probe,
): Probe {
  let known = probed.get(surface.geometry);
  if (!known) probed.set(surface.geometry, (known = new Map()));
  const key = [from, dir].map((p) => p.toArray().map((n) => n.toFixed(4))).join(';');
  const cached = known.get(key);
  if (cached) return cached;
  const result = cast(surface, from, dir, fallback);
  known.set(key, result);
  return result;
}

function cast(
  surface: THREE.SkinnedMesh,
  from: THREE.Vector3,
  dir: THREE.Vector3,
  fallback: Probe,
): Probe {
  const ray = new THREE.Raycaster(from, dir.clone().normalize(), 0, 2);
  const hit = ray.intersectObject(surface, false)[0];
  if (!hit?.face) return fallback;
  // the face normal is in geometry space; the bind pose is the rest pose, so the world-space
  // normal is the mesh's normal matrix applied to it
  const normal = hit.face.normal.clone().transformDirection(surface.matrixWorld);
  return { point: hit.point.clone(), normal };
}

/** Parent `obj` to `bone`, keeping the given bind-pose world placement (handles bone scale). */
function attach(
  bone: THREE.Object3D,
  obj: THREE.Object3D,
  position: THREE.Vector3,
  quaternion = new THREE.Quaternion(),
): void {
  const local = new THREE.Matrix4()
    .compose(position, quaternion, new THREE.Vector3(1, 1, 1))
    .premultiply(bone.matrixWorld.clone().invert());
  local.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}

const UP = new THREE.Vector3(0, 1, 0);
const facing = (normal: THREE.Vector3, axis = UP) =>
  new THREE.Quaternion().setFromUnitVectors(axis, normal.clone().normalize());

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name?: string) {
  const m = new THREE.Mesh(geometry, material);
  if (name) m.name = name;
  return m;
}

// ── Hardware ───────────────────────────────────────────────────────────────────
/**
 * Hardware geometry is shared by every astronaut instance (module cache): SC02, SC03 and SC04 each
 * mount a clone, and per-clone geometry was never released when chapters unmounted (a leak found
 * by the P4 memory check).
 */
const geometryCache = new Map<string, THREE.BufferGeometry>();
function geom<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometryCache.get(key);
  if (!g) {
    g = make();
    geometryCache.set(key, g);
  }
  return g as T;
}
// ── Hardware ───────────────────────────────────────────────────────────────────
function helmet(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Astro_Helmet';
  const R = 0.158;
  const shell = mesh(
    geom('SphereGeometry(R,40,28)', () => new THREE.SphereGeometry(R, 40, 28)),
    SHELL,
  );
  shell.scale.set(0.96, 1.0, 1.04);
  // three's sphere: φ = π/2 faces +z (the rig's forward). θ from the top.
  const frame = mesh(
    geom(
      'SphereGeometry(R+0.004,40,18,Math.PI*0.12,Math.PI*0.76,Math.PI*0.22,Math.PI*0.44)',
      () =>
        new THREE.SphereGeometry(
          R + 0.004,
          40,
          18,
          Math.PI * 0.12,
          Math.PI * 0.76,
          Math.PI * 0.22,
          Math.PI * 0.44,
        ),
    ),
    TRIM,
  );
  frame.scale.copy(shell.scale);
  const visor = mesh(
    geom(
      'SphereGeometry(R+0.008,40,16,Math.PI*0.17,Math.PI*0.66,Math.PI*0.26,Math.PI*0.36)',
      () =>
        new THREE.SphereGeometry(
          R + 0.008,
          40,
          16,
          Math.PI * 0.17,
          Math.PI * 0.66,
          Math.PI * 0.26,
          Math.PI * 0.36,
        ),
    ),
    VISOR,
    'Astro_Visor',
  );
  visor.scale.copy(shell.scale);
  g.add(shell, frame, visor);
  // small visor hinge pods on both sides
  for (const s of [-1, 1]) {
    const pod = mesh(
      geom(
        'CylinderGeometry(0.022,0.025,0.018,24)',
        () => new THREE.CylinderGeometry(0.022, 0.025, 0.018, 24),
      ),
      TRIM,
    );
    pod.rotation.z = Math.PI / 2;
    pod.position.set(s * R * 0.95, 0.0, 0.02);
    const cap = mesh(
      geom(
        'CylinderGeometry(0.01,0.01,0.022,16)',
        () => new THREE.CylinderGeometry(0.01, 0.01, 0.022, 16),
      ),
      METAL,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.copy(pod.position);
    g.add(pod, cap);
  }
  // neck seal ring where the helmet locks onto the collar
  const seal = mesh(
    geom('TorusGeometry(0.118,0.016,12,40)', () => new THREE.TorusGeometry(0.118, 0.016, 12, 40)),
    TRIM,
  );
  seal.rotation.x = Math.PI / 2;
  seal.position.y = -R * 0.8;
  const lock = mesh(
    geom('TorusGeometry(0.121,0.006,8,40)', () => new THREE.TorusGeometry(0.121, 0.006, 8, 40)),
    METAL,
  );
  lock.rotation.x = Math.PI / 2;
  lock.position.y = -R * 0.8 - 0.012;
  g.add(seal, lock);
  return g;
}

function patch(): THREE.Group {
  const g = new THREE.Group();
  const disc = mesh(
    geom(
      'CylinderGeometry(0.036,0.036,0.004,32)',
      () => new THREE.CylinderGeometry(0.036, 0.036, 0.004, 32),
    ),
    PATCH,
  );
  const rim = mesh(
    geom('TorusGeometry(0.036,0.004,6,32)', () => new THREE.TorusGeometry(0.036, 0.004, 6, 32)),
    PATCH_RIM,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.002;
  g.add(disc, rim);
  return g;
}

function connector(): THREE.Group {
  const g = new THREE.Group();
  const plate = mesh(
    geom('BoxGeometry(0.075,0.012,0.1)', () => new THREE.BoxGeometry(0.075, 0.012, 0.1)),
    SHELL,
  );
  const port = mesh(
    geom(
      'CylinderGeometry(0.022,0.024,0.024,24)',
      () => new THREE.CylinderGeometry(0.022, 0.024, 0.024, 24),
    ),
    TRIM,
  );
  port.position.y = 0.014;
  const pin = mesh(
    geom(
      'CylinderGeometry(0.01,0.01,0.028,12)',
      () => new THREE.CylinderGeometry(0.01, 0.01, 0.028, 12),
    ),
    METAL,
  );
  pin.position.y = 0.016;
  g.add(plate, port, pin);
  return g;
}

function wristRing(radius: number): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(
    geom(
      `TorusGeometry(${radius.toFixed(4)},0.009,10,32)`,
      () => new THREE.TorusGeometry(radius, 0.009, 10, 32),
    ),
    TRIM,
  );
  const band = mesh(
    geom(
      `TorusGeometry(${(radius + 0.002).toFixed(4)},0.004,6,32)`,
      () => new THREE.TorusGeometry(radius + 0.002, 0.004, 6, 32),
    ),
    METAL,
  );
  band.position.z = 0.006;
  g.add(ring, band);
  return g;
}

function collar(): THREE.Mesh {
  // fabric neck dam: open cone from the shoulders up to the helmet's neck seal
  const c = mesh(
    geom(
      'CylinderGeometry(0.112,0.15,0.09,32,1,true)',
      () => new THREE.CylinderGeometry(0.112, 0.15, 0.09, 32, 1, true),
    ),
    SUIT_COLLAR,
  );
  return c;
}
const SUIT_COLLAR = new THREE.MeshPhysicalMaterial({
  color: C.fabric,
  roughness: 0.8,
  sheen: 0.3,
  sheenRoughness: 0.8,
  side: THREE.DoubleSide,
});

// ── Dress ──────────────────────────────────────────────────────────────────────
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Dress a freshly cloned (bind-pose) Y Bot. Must run before any animation is applied to it.
 */
export function dressAstronaut(model: THREE.Object3D, shadows: boolean): void {
  model.updateMatrixWorld(true);
  let surface: THREE.SkinnedMesh | undefined;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const joints = /Joint/i.test(m.name);
    paintZones(m, joints);
    m.material = SUIT;
    m.castShadow = shadows;
    m.receiveShadow = true;
    m.frustumCulled = false; // skinned bounds don't follow the animation
    if (!joints) surface = m;
  });
  if (!surface) throw new Error('Astronaut: body surface mesh missing');
  // ~1 cm of suit over the body, in model-local units.
  // Metres per geometry unit, measured (the quantized attributes and bind matrices make the node
  // scale misleading): bind-pose body height (feet to helmet top, from the bones) over the
  // geometry's own height.
  const g = surface.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const localH = g.boundingBox ? g.boundingBox.max.y - g.boundingBox.min.y : 0;
  const headY = model.getObjectByName('mixamorigHead')?.getWorldPosition(new THREE.Vector3()).y;
  const unit = localH > 0 && headY ? (headY + 0.17) / localH : 1;
  inflate.value = 0.012 / unit;

  const bone = (name: string) => {
    const b = model.getObjectByName(`mixamorig${name}`);
    if (!b) throw new Error(`Astronaut: bone ${name} missing`);
    return b;
  };
  surface.skeleton.update(); // bone matrices for raycasting the bind pose
  const parts: THREE.Object3D[] = [];
  const put = (b: string, obj: THREE.Object3D, p: THREE.Vector3, q?: THREE.Quaternion) => {
    attach(bone(b), obj, p, q);
    parts.push(obj);
  };

  // helmet on the head (centre ~10 cm above the head bone, as verified in P3)
  const head = bone('Head').getWorldPosition(new THREE.Vector3());
  put('Head', helmet(), head.clone().add(v(0, 0.1, 0.015)));

  // collar on the neck, reaching up to the neck seal
  const neck = bone('Neck').getWorldPosition(new THREE.Vector3());
  put('Neck', collar(), v(neck.x, neck.y + 0.0, neck.z + 0.005));

  // wrist rings (T-pose: the forearm runs along ±x), sized from the measured arm surface
  for (const side of ['Left', 'Right'] as const) {
    const hand = bone(`${side}Hand`).getWorldPosition(new THREE.Vector3());
    const sx = side === 'Left' ? -1 : 1; // a little up the forearm from the wrist joint
    const at = hand.clone().add(v(sx * 0.02, 0, 0));
    const top = probe(surface, at.clone().add(v(0, 0.3, 0)), v(0, -1, 0), {
      point: at.clone().add(v(0, 0.04, 0)),
      normal: UP,
    });
    // measured half-thickness + suit inflation, slightly under so the ring hugs the sleeve
    const r = Math.max(0.022, Math.min(0.032, top.point.y - at.y)) + 0.012 - 0.002;
    put(`${side}Hand`, wristRing(r), at, new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2));
  }

  // mission patch on top of the left upper arm (T-pose; it faces outwards with the arms down)
  const lArm = bone('LeftArm').getWorldPosition(new THREE.Vector3());
  const lFore = bone('LeftForeArm').getWorldPosition(new THREE.Vector3());
  const patchAt = lArm.clone().lerp(lFore, 0.38);
  const p = probe(surface, patchAt.clone().add(v(0, 0.3, 0)), v(0, -1, 0), {
    point: patchAt.clone().add(v(0, 0.05, 0)),
    normal: UP,
  });
  put('LeftArm', patch(), p.point.clone().addScaledVector(p.normal, 0.012), facing(p.normal));

  // umbilical connector on the front of the right thigh
  const rUp = bone('RightUpLeg').getWorldPosition(new THREE.Vector3());
  const rKnee = bone('RightLeg').getWorldPosition(new THREE.Vector3());
  const thigh = rUp.clone().lerp(rKnee, 0.42);
  const t = probe(surface, thigh.clone().add(v(-0.03, 0, 0.4)), v(0, 0, -1), {
    point: thigh.clone().add(v(0, 0, 0.08)),
    normal: v(0, 0, 1),
  });
  put(
    'RightUpLeg',
    connector(),
    t.point.clone().addScaledVector(t.normal, 0.014),
    facing(t.normal),
  );

  for (const part of parts)
    part.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = shadows;
    });
}
