export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

export const HEX_SIZE = 2.4;

const SQRT3 = Math.sqrt(3);

const RING_WALK_DIRECTIONS: readonly AxialCoord[] = Object.freeze([
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
]);

export function axialToWorldXZ(
  { q, r }: AxialCoord,
  size: number = HEX_SIZE,
): { readonly x: number; readonly z: number } {
  const x = size * SQRT3 * (q + r / 2);
  const z = size * 1.5 * r;
  return { x, z };
}

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

export function hexDisc(radius: number): AxialCoord[] {
  const result: AxialCoord[] = [];
  for (let i = 0; i <= radius; i++) {
    const ring = hexRing(i);
    for (let j = 0; j < ring.length; j++) {
      result.push(ring[j]);
    }
  }
  return result;
}
