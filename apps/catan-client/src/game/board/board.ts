import { Group } from 'three';
import { makeStandardLandPlacements, TileType } from '@catan/shared-game-field';
import { createTile } from '../tiles/tile-factory';
import { Tile } from '../tiles/tile';

export interface BoardOptions {
  readonly seed?: number;
}

export class Board {
  readonly group: Group = new Group();
  readonly tiles: Tile[] = [];

  constructor(options: BoardOptions = {}) {
    const placements = makeStandardLandPlacements(options.seed);
    for (const placement of placements) {
      const tile = createTile(placement);
      this.tiles.push(tile);
      this.group.add(tile.group);
    }
    this.markFirstSettled(TileType.Forest);
    this.markFirstSettled(TileType.Fields);
    this.markFirstSettled(TileType.Mountains);
  }

  private markFirstSettled(type: TileType): void {
    const tile = this.tiles.find((t) => t.type === type);
    if (tile) tile.settled = true;
  }

  update(dt: number, t: number): void {
    for (const tile of this.tiles) tile.update(dt, t);
  }

  dispose(): void {
    for (const tile of this.tiles) tile.dispose();
  }
}
