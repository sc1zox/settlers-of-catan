import { Vector3 } from 'three';

/**
 * Pointy-top axial hex coordinates.
 * x/z plane = ground, +Y up.
 */
export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

export const HEX_SIZE = 2.4;
const SQRT3 = Math.sqrt(3);

/**
 * Six neighbour directions in axial coordinates, ordered for walking a ring
 * counter-clockwise starting at the (radius, -radius) corner.
 */
const RING_WALK_DIRECTIONS: readonly AxialCoord[] = Object.freeze([
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
]);

export function axialToWorld({ q, r }: AxialCoord, size: number = HEX_SIZE): Vector3 {
  const x = size * SQRT3 * (q + r / 2);
  const z = size * 1.5 * r;
  return new Vector3(x, 0, z);
}

/** All axial coords on the ring at exactly `radius` from the origin. */
export function hexRing(radius: number): AxialCoord[] {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const result: AxialCoord[] = [];
  let q = radius;
  let r = -radius;
  for (const dir of RING_WALK_DIRECTIONS) {
    for (let step = 0; step < radius; step++) {
      result.push({ q, r });
      q += dir.q;
      r += dir.r;
    }
  }
  return result;
}

/** Filled hex disc of given radius — center + all rings up to radius. */
export function hexDisc(radius: number): AxialCoord[] {
  const result: AxialCoord[] = [];
  for (let i = 0; i <= radius; i++) result.push(...hexRing(i));
  return result;
}
