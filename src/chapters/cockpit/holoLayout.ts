/**
 * The cockpit's holographic display (SC04): the crew record and flight plan hang in the air above
 * the dash on clear glass, each fed by a projector set into the panel, with a globe over the middle
 * one and layers of light behind and before them (cockpit metres; origin on the floor, nose -z).
 */
import { panePoint } from '../holo/geometry.ts';
import { HUD, hudRects } from '../holo/hud.ts';
import { KIND, SCREEN, layer, pane } from '../holo/panes.ts';
import type { AtlasRect, Pane, Vec3 } from '../holo/panes.ts';

export const ATLAS = { width: 2048, height: 1280 + HUD.height } as const;

export const HUD_TOP = 1280;
const hud = hudRects(HUD_TOP);

export const RECTS = {
  experience: { x: 0, y: 0, w: 1024, h: 640 },
  plan: { x: 1024, y: 0, w: 1024, h: 640 },
  education: { x: 0, y: 640, w: 1024, h: 640 },
  ...hud,
} as const satisfies Record<string, AtlasRect>;

/** The tilted instrument panel (Cockpit.tsx): its centre, backward tilt and face (half depth). */
export const DASH = { y: 1.0, z: -1.3, tilt: 0.5, face: 0.0415 } as const;

/** A point on the panel's face: `x` across, `up` the slope from its centre. */
export function onDash(x: number, up: number): Vec3 {
  const cos = Math.cos(DASH.tilt);
  const sin = Math.sin(DASH.tilt);
  return [x, DASH.y + up * cos + DASH.face * sin, DASH.z - up * sin + DASH.face * cos];
}

const screen = (rect: AtlasRect, position: Vec3, rotationY: number, delay: number): Pane =>
  pane({
    kind: KIND.screen,
    screen: SCREEN.record,
    rect,
    position,
    rotationY,
    rotationX: -0.22,
    width: 0.66,
    height: 0.4125,
    curve: 0.03,
    float: 0.004,
    folds: true,
    delay,
  });

export const SCREENS = {
  experience: screen(RECTS.experience, [-0.74, 1.35, -1.07], 0.34, 0),
  plan: screen(RECTS.plan, [0, 1.34, -1.14], 0, 0.08),
  education: screen(RECTS.education, [0.74, 1.35, -1.07], -0.34, 0.16),
} as const;

/** The globe over the flight plan. */
export const GLOBE = { position: [0, 1.7, -1.17] as Vec3, radius: 0.105 } as const;

/** Where on the panel (up the slope) the projector strips lie. */
const STRIP_UP = -0.07;

/** The light from a projector strip to its screen's lower edge. */
function beam(target: Pane): Pane {
  const x = target.position[0];
  const lowerCorner = (side: number): Vec3 =>
    panePoint(target, (side * target.width) / 2, -target.height / 2).toArray();
  return pane({
    kind: KIND.beam,
    width: target.width,
    height: 0.24,
    folds: true,
    delay: target.delay,
    corners: [
      lowerCorner(-1),
      lowerCorner(1),
      onDash(x - 0.23, STRIP_UP),
      onDash(x + 0.23, STRIP_UP),
    ],
  });
}

const rings = (rect: AtlasRect, position: Vec3, size: number, overrides: Partial<Pane>): Pane =>
  pane({
    kind: KIND.dial,
    rect,
    position,
    width: size,
    height: size,
    folds: true,
    ...overrides,
  });

/** A small clear window in front of the screens. */
const chip = (rect: AtlasRect, position: Vec3, width: number, overrides: Partial<Pane>): Pane =>
  layer(rect, position, width, {
    kind: KIND.screen,
    screen: SCREEN.glass,
    folds: true,
    ...overrides,
  });

const all = Object.values(SCREENS);
const folds = true;

/** In drawing order, farthest first. */
export const PANES: readonly Pane[] = [
  // far: great rings round the globe, a hex field and a network over the windscreen
  rings(hud.ring, [0, 1.62, -1.37], 0.86, { gain: 0.2, soft: 1.4, detail: true, delay: 0.1 }),
  layer(hud.hex, [-0.52, 1.74, -1.32], 0.52, {
    rotationY: 0.22,
    gain: 0.38,
    soft: 1.2,
    folds,
    delay: 0.3,
  }),
  layer(hud.nodes, [0.52, 1.74, -1.32], 0.52, {
    rotationY: -0.22,
    gain: 0.4,
    soft: 1.2,
    folds,
    delay: 0.34,
  }),
  // out to the sides
  layer(hud.ship, [-1.2, 1.5, -0.86], 0.46, {
    rotationY: 0.9,
    gain: 0.5,
    soft: 0.9,
    folds,
    delay: 0.4,
  }),
  layer(hud.data, [1.2, 1.5, -0.86], 0.34, {
    rotationY: -0.9,
    gain: 0.5,
    soft: 0.9,
    folds,
    delay: 0.42,
  }),
  // the strips on the panel
  ...all.map((s) =>
    pane({
      kind: KIND.emitter,
      position: onDash(s.position[0], STRIP_UP),
      rotationX: -DASH.tilt,
      width: 0.46,
      height: 0.032,
      folds: true,
    }),
  ),
  // the globe's own rings: one facing the crew, one lying round its middle
  rings(hud.dial, GLOBE.position, 0.34, { gain: 0.4, soft: 0.7, delay: 0.2 }),
  rings(hud.ring, GLOBE.position, 0.4, { rotationX: -1.36, gain: 0.45, soft: 0.7, delay: 0.26 }),
  ...all.map(beam),
  ...all,
  // near: small windows that slide past the screens as the camera moves
  rings(hud.dial, [-0.37, 1.58, -1.0], 0.1, { gain: 0.45, soft: 0.8, float: 0.01, delay: 0.38 }),
  rings(hud.dial, [0.37, 1.58, -1.0], 0.1, { gain: 0.45, soft: 0.8, float: 0.01, delay: 0.4 }),
  chip(hud.data, [-0.4, 1.09, -0.93], 0.13, { rotationY: 0.2, gain: 0.5, soft: 0.8, delay: 0.44 }),
  chip(hud.wave, [0.4, 1.08, -0.93], 0.2, { rotationY: -0.2, gain: 0.5, soft: 0.8, delay: 0.46 }),
];
