/**
 * The floating screens over the desk (SC02/SC03): where each pane hangs (room metres) and where its
 * picture sits on the desk's atlas.
 */
import { HUD, hudRects } from '../holo/hud.ts';
import { KIND, SCREEN, layer, pane } from '../holo/panes.ts';
import type { AtlasRect, Pane, Vec3 } from '../holo/panes.ts';
import { DESK, KEYBOARD } from './layout.ts';

export const ATLAS = { width: 2048, height: 1024 + HUD.height } as const;

export const HUD_TOP = 1024;
const hud = hudRects(HUD_TOP);

export const RECTS = {
  main: { x: 0, y: 0, w: 1280, h: 672 },
  engine: { x: 1280, y: 0, w: 768, h: 512 },
  flight: { x: 1280, y: 512, w: 768, h: 512 },
  keys: { x: 352, y: 672, w: 743, h: 352 },
  ...hud,
} as const satisfies Record<string, AtlasRect>;

/** The part of the main pane whose code scrolls (pane pixels); it holds a whole number of lines. */
export const CODE = { top: 72, line: 24, lines: 24, width: 880 } as const;

/** The radar on the flight-plan pane (pane pixels): the shader sweeps it. */
export const RADAR = { x: 262, y: 288, radius: 190 } as const;

const screen = (
  index: Pane['screen'],
  rect: AtlasRect,
  position: Vec3,
  rotationY: number,
  width: number,
  curve: number,
): Pane =>
  pane({
    kind: KIND.screen,
    screen: index,
    rect,
    position,
    rotationY,
    width,
    height: (width * rect.h) / rect.w,
    curve,
    float: 0.006,
    // part of the room, not over it
    gain: index === SCREEN.code ? 0.68 : 0.6,
    soft: index === SCREEN.code ? 0.35 : 0.55,
  });

/** A small clear window in front of the screens. */
const chip = (rect: AtlasRect, position: Vec3, width: number, rotationY: number): Pane =>
  layer(rect, position, width, {
    kind: KIND.screen,
    screen: SCREEN.glass,
    rotationY,
    gain: 0.5,
    soft: 0.6,
  });

const rings = (rect: AtlasRect, position: Vec3, size: number, overrides: Partial<Pane>): Pane =>
  pane({ kind: KIND.dial, rect, position, width: size, height: size, ...overrides });

/** Where the light that feeds the screens leaves the desk. */
export const EMITTER = { z: -2.66, width: 0.62, depth: 0.05 } as const;

const MAIN = screen(SCREEN.code, RECTS.main, [0, DESK.top + 0.5, -2.76], 0, 0.94, 0.055);
/** From the emitter to the main screen's lower edge. */
const BEAM_RISE = MAIN.position[1] - MAIN.height / 2 - DESK.top;
const BEAM_RUN = MAIN.position[2] - EMITTER.z;

/** In drawing order, farthest first. */
export const PANES: readonly Pane[] = [
  // far: great rings behind the code, a hex field and a blueprint above, windows out to the sides
  rings(hud.ring, [0, DESK.top + 0.66, -2.98], 1.12, { gain: 0.14, soft: 1.5, detail: true }),
  layer(hud.hex, [-0.64, DESK.top + 0.9, -2.9], 0.5, { rotationY: 0.25, gain: 0.32, soft: 1.3 }),
  layer(hud.ship, [0.6, DESK.top + 0.93, -2.92], 0.52, { rotationY: -0.25, gain: 0.32, soft: 1.3 }),
  layer(hud.nodes, [-1.2, DESK.top + 0.56, -2.1], 0.44, { rotationY: 1.15, gain: 0.36, soft: 1.2 }),
  layer(hud.data, [1.27, DESK.top + 0.6, -2.28], 0.34, { rotationY: -1.1, gain: 0.36, soft: 1.2 }),
  pane({
    kind: KIND.emitter,
    position: [0, DESK.top + 0.0015, EMITTER.z],
    rotationX: -Math.PI / 2,
    width: EMITTER.width,
    height: EMITTER.depth,
    gain: 0.6,
  }),
  // the light from the desk up to the main screen's lower edge
  pane({
    kind: KIND.beam,
    position: [0, DESK.top + BEAM_RISE / 2, EMITTER.z + BEAM_RUN / 2],
    rotationX: Math.atan2(BEAM_RUN, BEAM_RISE),
    width: MAIN.width,
    height: Math.hypot(BEAM_RISE, BEAM_RUN),
    gain: 0.55,
  }),
  MAIN,
  // the side screens turn in toward the seat
  screen(SCREEN.engine, RECTS.engine, [-0.82, DESK.top + 0.5, -2.42], 0.75, 0.58, 0.028),
  // higher and farther back than its twin: Raju's hologram stands in front of it
  screen(SCREEN.flight, RECTS.flight, [0.89, DESK.top + 0.57, -2.61], -0.65, 0.58, 0.028),
  rings(hud.dial, [-0.52, DESK.top + 0.83, -2.6], 0.2, {
    rotationY: 0.45,
    float: 0.01,
    gain: 0.45,
    soft: 0.8,
  }),
  rings(hud.dial, [0.53, DESK.top + 0.86, -2.7], 0.14, {
    rotationY: -0.3,
    float: 0.01,
    gain: 0.45,
    soft: 0.8,
  }),
  // near: a trace sliding in front of the code
  chip(hud.wave, [-0.3, DESK.top + 0.25, -2.56], 0.22, 0.15),
  // keys of light over the keyboard
  pane({
    kind: KIND.keys,
    rect: RECTS.keys,
    position: [KEYBOARD.x, DESK.top + KEYBOARD.size[1] + 0.0012, KEYBOARD.z],
    rotationX: -Math.PI / 2,
    width: KEYBOARD.size[0],
    height: KEYBOARD.size[2],
    gain: 0.75,
  }),
];
