import { Group } from 'three';
import { WATER_LEVEL_Y } from '../tiles/tile';
import { WaterSurface } from './water-surface';

export interface WorldOptions {
  /** Disc radius — water surface extends out to this distance from the origin. */
  readonly discRadius: number;
}

/** Everything outside the land: the round water surface around the island. */
export class World {
  readonly group: Group = new Group();
  private readonly water: WaterSurface;

  constructor(options: WorldOptions) {
    this.water = new WaterSurface(options.discRadius);
    this.water.mesh.position.y = WATER_LEVEL_Y;
    this.group.add(this.water.mesh);
  }

  update(_dt: number, t: number): void {
    this.water.update(t);
  }

  dispose(): void {
    this.water.dispose();
  }
}
