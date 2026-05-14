import { AxialCoord, hexDisc } from './hex-layout';
import { TilePlacement } from './tile-placement';
import {
  isResourceTile,
  ResourceTileType,
  shuffled,
  STANDARD_LAND_BAG,
  STANDARD_NUMBER_BAG,
  TileType,
} from './tile-type';

function isCenter(coord: AxialCoord): boolean {
  return coord.q === 0 && coord.r === 0;
}

function seedToRng(seed: number | undefined): () => number {
  if (seed === undefined) return Math.random;
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeStandardLandPlacements(seed?: number): TilePlacement[] {
  const rng = seedToRng(seed);
  const landCoords = hexDisc(2);
  const resourceCoords = landCoords.filter((c) => !isCenter(c));
  const resourceTypes = shuffled(
    STANDARD_LAND_BAG.filter(isResourceTile),
    rng,
  ) as ResourceTileType[];
  const numbers = shuffled(STANDARD_NUMBER_BAG, rng);
  const placements: TilePlacement[] = [];
  placements.push({ coord: { q: 0, r: 0 }, type: TileType.Desert, number: null });
  for (let i = 0; i < resourceCoords.length; i++) {
    placements.push({
      coord: resourceCoords[i],
      type: resourceTypes[i],
      number: numbers[i],
    });
  }
  return placements;
}
