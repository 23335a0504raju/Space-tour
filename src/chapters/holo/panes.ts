/**
 * Floating screens (HoloPanes.tsx), used at the desk and in the cockpit: each pane of light, where
 * it hangs (metres, its set's own frame) and where its picture sits on that set's atlas (pixels
 * from the top left). No React or canvas, so layouts can be tested in node.
 */
export type Vec3 = readonly [number, number, number];

export interface AtlasRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AtlasSize {
  readonly width: number;
  readonly height: number;
}

/** What the shader does with a pane. `decor` is bare light with no glass: layers of the display. */
export const KIND = { screen: 0, dial: 1, keys: 2, emitter: 3, beam: 4, decor: 5 } as const;

/**
 * What a screen shows: three of them move (code, bars, radar), a record holds still to be read, and
 * glass is a small clear window of the display.
 */
export const SCREEN = { code: 0, engine: 1, flight: 2, record: 3, glass: 4 } as const;

export interface Pane {
  readonly kind: (typeof KIND)[keyof typeof KIND];
  readonly screen: (typeof SCREEN)[keyof typeof SCREEN];
  readonly rect: AtlasRect | null;
  /** Centre. */
  readonly position: Vec3;
  /** Turn about the vertical (positive faces toward +x). */
  readonly rotationY: number;
  /** Lean about its own horizontal axis (negative leans the top away; -PI/2 lies face up). */
  readonly rotationX: number;
  readonly width: number;
  readonly height: number;
  /** How far the left and right edges bend toward the viewer. */
  readonly curve: number;
  /** Amplitude of the slow float (metres); 0 for what rests on a surface. */
  readonly float: number;
  /** Folds away with the set's `open` value (what is built into a surface stays lit). */
  readonly folds: boolean;
  /** How late in the unfolding it starts (0 first, up to 0.5), so a set assembles piece by piece. */
  readonly delay: number;
  /** How bright it is, picture and edges (1 full). */
  readonly gain: number;
  /** How far out of focus its picture is (0 sharp; each 1 doubles the blur). */
  readonly soft: number;
  /** An extra layer, left out on the Low tier. */
  readonly detail: boolean;
  /** A flat pane given by its corners instead: top left, top right, bottom left, bottom right. */
  readonly corners?: readonly [Vec3, Vec3, Vec3, Vec3];
}

/** A pane with everything at rest; `overrides` says what it is. */
export function pane(overrides: Partial<Pane> & Pick<Pane, 'kind' | 'width' | 'height'>): Pane {
  return {
    screen: SCREEN.record,
    rect: null,
    position: [0, 0, 0],
    rotationY: 0,
    rotationX: 0,
    curve: 0,
    float: 0,
    folds: false,
    delay: 0,
    gain: 1,
    soft: 0,
    detail: false,
    ...overrides,
  };
}

/** A layer of the display: a picture of bare light, as tall as its picture's shape makes it. */
export function layer(
  rect: AtlasRect,
  position: Vec3,
  width: number,
  overrides: Partial<Pane> = {},
): Pane {
  return pane({
    kind: KIND.decor,
    rect,
    position,
    width,
    height: (width * rect.h) / rect.w,
    float: 0.007,
    detail: true,
    ...overrides,
  });
}
