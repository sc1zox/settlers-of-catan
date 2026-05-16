import { Vector3 } from 'three';
import { type AxialCoord, axialToWorldXZ, HEX_SIZE, hexRing } from '@catan/shared-game-field';

export type { AxialCoord };
export { HEX_SIZE, hexRing };

export function axialToWorld(coord: AxialCoord, size: number = HEX_SIZE): Vector3 {
  const { x, z } = axialToWorldXZ(coord, size);
  return new Vector3(x, 0, z);
}
