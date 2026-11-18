/**
 * Spacecraft dimensions in metres (no React/three imports, so story maths and tests can use them).
 * Origin = centre of the engine exit plane; the ship stands along +y.
 */
export const SHIP = {
  height: 12.5,
  radius: 1.5,
  hullBase: 1.0,
  windowY: 10.0,
  hatchY: 7.2,
} as const;
