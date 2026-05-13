/**
 * Hex tile categories — land resources, plus desert and water.
 * String enum so values are stable across logging / debugging.
 */
export enum TileType {
  Forest = 'forest',
  Fields = 'fields',
  Pasture = 'pasture',
  Hills = 'hills',
  Mountains = 'mountains',
  Desert = 'desert',
  Water = 'water',
}

/** A resource-producing land tile (excludes desert and water). */
export type ResourceTileType =
  | TileType.Forest
  | TileType.Fields
  | TileType.Pasture
  | TileType.Hills
  | TileType.Mountains;

/** All land tiles (resources + desert). */
export type LandTileType = ResourceTileType | TileType.Desert;

export const TILE_COLOR: Readonly<Record<TileType, number>> = {
  [TileType.Forest]: 0x2f5d3a,
  [TileType.Fields]: 0xd9b25c,
  [TileType.Pasture]: 0x7bbf5a,
  [TileType.Hills]: 0xa05a3a,
  [TileType.Mountains]: 0x7a7d85,
  [TileType.Desert]: 0xd6b275,
  [TileType.Water]: 0x2a6fa6,
};

/**
 * Classical Catan land tile distribution (19 land tiles):
 * 4 forest, 4 fields, 4 pasture, 3 hills, 3 mountains, 1 desert.
 */
export const STANDARD_LAND_BAG: readonly LandTileType[] = Object.freeze([
  TileType.Forest,
  TileType.Forest,
  TileType.Forest,
  TileType.Forest,
  TileType.Fields,
  TileType.Fields,
  TileType.Fields,
  TileType.Fields,
  TileType.Pasture,
  TileType.Pasture,
  TileType.Pasture,
  TileType.Pasture,
  TileType.Hills,
  TileType.Hills,
  TileType.Hills,
  TileType.Mountains,
  TileType.Mountains,
  TileType.Mountains,
  TileType.Desert,
]);

/** Number chips, one per non-desert land tile. */
export const STANDARD_NUMBER_BAG: readonly number[] = Object.freeze([
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
]);

/** Fisher–Yates shuffle returning a new array. */
export function shuffled<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isResourceTile(type: TileType): type is ResourceTileType {
  return (
    type === TileType.Forest ||
    type === TileType.Fields ||
    type === TileType.Pasture ||
    type === TileType.Hills ||
    type === TileType.Mountains
  );
}

export function isLandTile(type: TileType): type is LandTileType {
  return type !== TileType.Water;
}
