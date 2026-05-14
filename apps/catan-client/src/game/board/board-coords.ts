import { Vector3 } from 'three';
import { axialToWorld } from './hex';

/**
 * Maps server-authoritative vertex / edge identifiers onto board world
 * positions. The shared `board-topology` module keys vertices by the integer
 * cube coordinate string `"x,y,z"` of `3 × tileCentreCube + cornerOffset`.
 * A hex corner is the centroid of its three adjacent tiles, and each
 * `CORNER_OFFSET` is the sum of two adjacent neighbour unit vectors, so the
 * true corner cube coord is `centre + offset / 3` — i.e. the stored id
 * divided by three. Cube `(x,y,z)` maps to axial `(q,r) = (x,z)`, which
 * `axialToWorld` turns into an x/z world position (y left at 0 for the
 * caller to lift).
 *
 * This math is purely topological — it does not depend on the board seed, so
 * buildings land on geometrically correct corners regardless of which
 * resource tiles ended up where.
 */
export function vertexIdToWorld(vertexId: string): Vector3 {
  const parts = vertexId.split(',');
  const x3 = Number(parts[0]);
  const z3 = Number(parts[2]);
  return axialToWorld({ q: x3 / 3, r: z3 / 3 });
}

export interface EdgePlacement {
  /** Midpoint of the edge in world space (y = 0). */
  readonly position: Vector3;
  /** Y-axis rotation that aligns a local +X bar with the edge direction. */
  readonly angle: number;
  /** Edge length in world units (≈ HEX_SIZE for adjacent corners). */
  readonly length: number;
}

export function edgeIdToWorld(edgeId: string): EdgePlacement {
  const separator = edgeId.indexOf('|');
  const a = vertexIdToWorld(edgeId.slice(0, separator));
  const b = vertexIdToWorld(edgeId.slice(separator + 1));
  const position = a.clone().add(b).multiplyScalar(0.5);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  // A road bar is symmetric under a 180° flip, so the sign convention here
  // only needs to put the bar *on the line* — atan2(-dz, dx) aligns local +X.
  const angle = Math.atan2(-dz, dx);
  const length = Math.hypot(dx, dz);
  return { position, angle, length };
}
