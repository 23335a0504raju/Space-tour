import { forwardRef, useMemo, useRef } from 'react';
import { textureContext } from '../../engine/assets/canvas2d.ts';
import { useDisposeOnUnmount } from '../../engine/lifecycle.ts';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { seeded } from '../greybox/parts.tsx';
import { SHIP } from './dimensions.ts';

/**
 * The spacecraft: the character of every space chapter (decision R5, C23).
 * PROJECT_VISION §8: a believable near-future crew vehicle; compact, asymmetric in detail, visible
 * panel seams, RCS thrusters and heat tiles on one face; no fins or fighter-jet styling.
 *
 * Built in code (no free model fits the brief), in metres. Origin = centre of the engine exit
 * plane; the ship stands along +y, ~12.5 m tall, hull radius 1.5 m.
 *   -x face: crew windows and the hatch (they face the launch tower)
 *   +x face: heat-tile shield (pays off at the Sun)
 * Named parts per ASSET_PIPELINE: Ship_Hull, Ship_HeatShield, Ship_Windows, Ship_Hatch,
 * Ship_Engines, Ship_RCS, Ship_Legs.
 */
export { SHIP } from './dimensions.ts';

/** Mutable engine level 0..1 (written by the chapter from story time; no React state). */
export interface EngineLevel {
  current: number;
}

// ── Procedural textures (generated once, shared) ──────────────────────────────────
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = textureContext(canvas);
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Barrel panels: 8 around × 6 up, subtle tone variation, dark seams, a few access panels. */
const hullPanels = () =>
  canvasTexture(1024, 768, (c) => {
    const rand = seeded(57);
    const cols = 8;
    const rows = 6;
    const pw = 1024 / cols;
    const ph = 768 / rows;
    for (let i = 0; i < cols; i += 1)
      for (let j = 0; j < rows; j += 1) {
        const v = 214 + Math.round((rand() - 0.5) * 14);
        c.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
        c.fillRect(i * pw, j * ph, pw, ph);
        if (rand() < 0.22) {
          // small access panel
          c.strokeStyle = 'rgba(70,74,82,0.55)';
          c.lineWidth = 2;
          c.strokeRect(i * pw + pw * 0.25, j * ph + ph * 0.3, pw * 0.3, ph * 0.25);
        }
      }
    c.strokeStyle = 'rgba(52,56,64,0.9)';
    c.lineWidth = 3;
    for (let i = 0; i <= cols; i += 1) {
      c.beginPath();
      c.moveTo(i * pw, 0);
      c.lineTo(i * pw, 768);
      c.stroke();
    }
    for (let j = 0; j <= rows; j += 1) {
      c.beginPath();
      c.moveTo(0, j * ph);
      c.lineTo(1024, j * ph);
      c.stroke();
    }
  });

/** Heat tiles: small dark rectangles with gaps and per-tile tone variation. */
const heatTiles = () =>
  canvasTexture(512, 512, (c) => {
    const rand = seeded(91);
    c.fillStyle = '#0c0d10';
    c.fillRect(0, 0, 512, 512);
    const n = 16;
    const s = 512 / n;
    for (let i = 0; i < n; i += 1)
      for (let j = 0; j < n; j += 1) {
        const v = 30 + Math.round(rand() * 16);
        c.fillStyle = `rgb(${v},${v},${v + 3})`;
        const off = j % 2 ? s / 2 : 0; // staggered rows
        c.fillRect(i * s + off + 1.5, j * s + 1.5, s - 3, s - 3);
        if (off) c.fillRect(i * s - s / 2 + 1.5, j * s + 1.5, s - 3, s - 3);
      }
  });

let shared: ReturnType<typeof makeMaterials> | null = null;
function makeMaterials() {
  const panels = hullPanels();
  panels.repeat.set(1, 1);
  const tiles = heatTiles();
  tiles.repeat.set(5, 9);
  const tilesNose = tiles.clone();
  tilesNose.repeat.set(5, 4);
  return {
    hull: new THREE.MeshStandardMaterial({ map: panels, roughness: 0.42, metalness: 0.18 }),
    plain: new THREE.MeshStandardMaterial({ color: '#d9dce2', roughness: 0.42, metalness: 0.18 }),
    tiles: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85, metalness: 0.05 }),
    tilesNose: new THREE.MeshStandardMaterial({ map: tilesNose, roughness: 0.85, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2c31', roughness: 0.5, metalness: 0.6 }),
    bell: new THREE.MeshStandardMaterial({
      color: '#3b3836',
      roughness: 0.38,
      metalness: 0.85,
      side: THREE.DoubleSide,
    }),
    // cabin lights glow warm behind the windows (reads "crew aboard" in the onboard shot)
    glass: new THREE.MeshStandardMaterial({
      color: '#05070b',
      roughness: 0.04,
      metalness: 0.9,
      emissive: '#ffc277',
      emissiveIntensity: 0.9,
    }),
    gold: new THREE.MeshStandardMaterial({ color: '#c9973f', roughness: 0.3, metalness: 1 }),
  };
}
const materials = () => (shared ??= makeMaterials());

// ── Geometry (module scope: built once) ───────────────────────────────────────────
const v2 = (x: number, y: number) => new THREE.Vector2(x, y);
const R = SHIP.radius;
const BARREL = { y0: 1.7, y1: 8.4 } as const;
const NOSE_PROFILE = [
  v2(R, BARREL.y1),
  v2(1.47, 8.9),
  v2(1.38, 9.6),
  v2(1.2, 10.4),
  v2(0.92, 11.2),
  v2(0.55, 11.9),
  v2(0.2, 12.35),
  v2(0.0001, SHIP.height),
];
const SKIRT_PROFILE = [v2(1.42, SHIP.hullBase), v2(1.6, 1.3), v2(R, BARREL.y0)];
/** Engine bell (radius, y): throat at the top, exit at y = 0. */
const BELL_PROFILE = [v2(0.16, 1.15), v2(0.22, 0.95), v2(0.33, 0.62), v2(0.43, 0.25), v2(0.47, 0)];
const ENGINE_POS: ReadonlyArray<[number, number]> = [0, 1, 2].map((i) => {
  const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
  return [Math.sin(a) * 0.62, Math.cos(a) * 0.62];
});
/** Heat shield centred on +x: three's cylinder/lathe use x = r·sin(φ), z = r·cos(φ). */
const SHIELD_START = Math.PI / 2 - Math.PI * 0.42;
const SHIELD_LEN = Math.PI * 0.84;

const geo = {
  barrel: new THREE.CylinderGeometry(R, R, BARREL.y1 - BARREL.y0, 64, 1, true),
  nose: new THREE.LatheGeometry(NOSE_PROFILE, 64),
  skirt: new THREE.LatheGeometry(SKIRT_PROFILE, 64),
  base: new THREE.CircleGeometry(1.42, 48),
  shieldBarrel: new THREE.CylinderGeometry(
    R + 0.006,
    R + 0.006,
    BARREL.y1 - BARREL.y0,
    48,
    1,
    true,
    SHIELD_START,
    SHIELD_LEN,
  ),
  shieldNose: new THREE.LatheGeometry(
    NOSE_PROFILE.slice(0, 6).map((p) => v2(p.x + 0.006, p.y)),
    48,
    SHIELD_START,
    SHIELD_LEN,
  ),
  bell: new THREE.LatheGeometry(BELL_PROFILE, 32),
  bellGlow: new THREE.LatheGeometry(
    BELL_PROFILE.map((p) => v2(p.x * 0.96, p.y)),
    32,
  ),
  band: new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.12, 64, 1, true),
  window: new THREE.BoxGeometry(0.06, 0.34, 0.46),
  windowFrame: new THREE.BoxGeometry(0.05, 0.44, 0.56),
  hatchFrame: new THREE.BoxGeometry(0.04, 1.36, 0.96),
  hatch: new THREE.BoxGeometry(0.03, 1.24, 0.84),
  rcsBody: new THREE.BoxGeometry(0.22, 0.34, 0.3),
  rcsNozzle: new THREE.CylinderGeometry(0.035, 0.05, 0.08, 10),
  legStrut: new THREE.BoxGeometry(0.16, 2.9, 0.22),
  legFoot: new THREE.BoxGeometry(0.36, 0.08, 0.5),
};

/** Radius of the nose at height y (for placing parts flush with the surface). */
function noseRadius(y: number): number {
  for (let i = 1; i < NOSE_PROFILE.length; i += 1) {
    const a = NOSE_PROFILE[i - 1];
    const b = NOSE_PROFILE[i];
    if (a && b && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return 0;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  readonly engine?: EngineLevel;
  readonly position?: [number, number, number];
  readonly rotation?: [number, number, number];
  readonly castShadow?: boolean;
}

const ORIGIN: [number, number, number] = [0, 0, 0];
const GLOW_OFF = new THREE.Color('#000000');
const GLOW_HOT = new THREE.Color('#ff9a4a');

export const Spacecraft = forwardRef<THREE.Group, Props>(function Spacecraft(
  { engine, position = ORIGIN, rotation = ORIGIN, castShadow = false },
  ref,
) {
  const m = materials();
  // the bells glow from inside when the engines run: one material per instance
  const glow = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: GLOW_OFF.clone(),
        emissiveIntensity: 3,
        // inside the bell (radius × 0.96): the opaque bell hides it from outside
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useDisposeOnUnmount(glow);
  const last = useRef(-1);
  useFrame(() => {
    const e = engine?.current ?? 0;
    if (Math.abs(e - last.current) < 1e-3) return;
    last.current = e;
    glow.emissive.copy(GLOW_OFF).lerp(GLOW_HOT, Math.min(1, e * 1.4));
  });

  const windowR = noseRadius(SHIP.windowY);
  const noseSlope = Math.atan2(1.38 - 1.2, 10.4 - 9.6); // lean of the nose surface at the windows

  return (
    <group ref={ref} position={position} rotation={rotation} name="Ship">
      <group name="Ship_Hull">
        <mesh
          geometry={geo.barrel}
          material={m.hull}
          position={[0, (BARREL.y0 + BARREL.y1) / 2, 0]}
          castShadow={castShadow}
          receiveShadow
        />
        <mesh geometry={geo.nose} material={m.plain} castShadow={castShadow} receiveShadow />
        <mesh geometry={geo.skirt} material={m.dark} castShadow={castShadow} />
        <mesh
          geometry={geo.base}
          material={m.dark}
          position={[0, SHIP.hullBase, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* gold ring between barrel and crew section */}
        <mesh geometry={geo.band} material={m.gold} position={[0, BARREL.y1 - 0.25, 0]} />
      </group>

      <group name="Ship_HeatShield">
        <mesh
          geometry={geo.shieldBarrel}
          material={m.tiles}
          position={[0, (BARREL.y0 + BARREL.y1) / 2, 0]}
        />
        <mesh geometry={geo.shieldNose} material={m.tilesNose} />
      </group>

      {/* crew windows on the -x face, leaning with the nose */}
      <group name="Ship_Windows">
        {[-0.34, 0, 0.34].map((a) => (
          // rotate about the ship axis onto the -x face, then sit on the nose surface, tilted up
          // with it (Rx(-θ) turns the +z normal upwards)
          <group key={a} rotation={[0, -Math.PI / 2 + a, 0]}>
            <group position={[0, SHIP.windowY, windowR]} rotation={[-noseSlope, Math.PI / 2, 0]}>
              <mesh geometry={geo.windowFrame} material={m.dark} />
              <mesh geometry={geo.window} material={m.glass} position={[-0.012, 0, 0]} />
            </group>
          </group>
        ))}
      </group>

      {/* side hatch on the -x face (the crew arm docks here) */}
      <group name="Ship_Hatch" position={[-R - 0.01, SHIP.hatchY, 0]}>
        <mesh geometry={geo.hatchFrame} material={m.dark} />
        <mesh geometry={geo.hatch} material={m.plain} position={[-0.012, 0, 0]} />
      </group>

      {/* RCS quads: two rings of four, at 45° off the faces */}
      <group name="Ship_RCS">
        {[2.3, 9.2].flatMap((y) =>
          [0, 1, 2, 3].map((i) => {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            const r = y > 8.4 ? noseRadius(y) : R;
            return (
              <group key={`${y}-${i}`} rotation={[0, a, 0]}>
                <group position={[0, y, r + 0.09]}>
                  <mesh geometry={geo.rcsBody} material={m.dark} />
                  {[-0.09, 0, 0.09].map((dz) => (
                    <mesh
                      key={dz}
                      geometry={geo.rcsNozzle}
                      material={m.bell}
                      position={[dz, 0.17, 0.05]}
                    />
                  ))}
                </group>
              </group>
            );
          }),
        )}
      </group>

      {/* landing legs, stowed flat against the skirt */}
      <group name="Ship_Legs">
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh geometry={geo.legStrut} material={m.dark} position={[0, 2.95, R + 0.1]} />
            <mesh geometry={geo.legFoot} material={m.dark} position={[0, 1.5, R + 0.14]} />
          </group>
        ))}
      </group>

      <group name="Ship_Engines" position={[0, 0, 0]}>
        {ENGINE_POS.map(([x, z]) => (
          <group key={`${x}`} position={[x, 0, z]}>
            <mesh geometry={geo.bell} material={m.bell} castShadow={castShadow} />
            <mesh geometry={geo.bellGlow} material={glow} />
          </group>
        ))}
      </group>
    </group>
  );
});

/** Engine exit positions (x, z) in ship space, for plumes. */
export const ENGINE_EXITS = ENGINE_POS;
