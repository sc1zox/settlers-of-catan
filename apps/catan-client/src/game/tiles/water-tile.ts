import { Tile, TileInit } from './tile';

export class WaterTile extends Tile {
  constructor(init: TileInit) {
    super(init);
    // Disable shadow receiving so water reads as a flat surface; otherwise stippling shows.
    this.group.traverse((obj) => {
      obj.castShadow = false;
    });
  }
}
