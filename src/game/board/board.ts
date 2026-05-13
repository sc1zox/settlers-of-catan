import { Group } from 'three';
import { createTile, TilePlacement } from '../tiles/tile-factory';
import { Tile } from '../tiles/tile';
import { AxialCoord, hexDisc } from './hex';
import {
  isResourceTile,
  ResourceTileType,
  shuffled,
  STANDARD_LAND_BAG,
  STANDARD_NUMBER_BAG,
  TileType,
} from './tile-types';

export interface BoardOptions {
  readonly seed?: number;
}

/**
 * Classical Catan land: 19 hex tiles (3-4-5-4-3). Desert fixed at the centre,
 * 18 resource tiles randomly shuffled around it. Water and harbors live in the
 * `World` class — the board owns land only.
 */
export class Board {
  readonly group: Group = new Group();
  readonly tiles: Tile[] = [];

  constructor(options: BoardOptions = {}) {
    const placements = this.makePlacements(options.seed);
    for (const placement of placements) {
      const tile = createTile(placement);
      this.tiles.push(tile);
      this.group.add(tile.group);
    }
    // Demo: mark one tile of each producing type as "settled" so the actor
    // decorations (lumberjack / windmill / mine) become visible without UI.
    this.markFirstSettled(TileType.Forest);
    this.markFirstSettled(TileType.Fields);
    this.markFirstSettled(TileType.Mountains);
  }

  private markFirstSettled(type: TileType): void {
    const tile = this.tiles.find((t) => t.type === type);
    if (tile) tile.settled = true;
  }

  private makePlacements(seed?: number): TilePlacement[] {
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

  update(dt: number, t: number): void {
    for (const tile of this.tiles) tile.update(dt, t);
  }

  dispose(): void {
    for (const tile of this.tiles) tile.dispose();
  }
}

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
