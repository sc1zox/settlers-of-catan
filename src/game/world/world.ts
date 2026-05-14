import { Group } from 'three';
import { WATER_LEVEL_Y } from '../tiles/tile';
import { Cliffs } from './cliffs';
import { WaterSurface } from './water-surface';

export interface WorldOptions {
  /** Disc radius — water surface extends out to this distance from the origin. */
  readonly discRadius: number;
  /** World Y at the tabletop surface — cliff base sits here. */
  readonly tableTopY: number;
}

/** Everything outside the land: the round water surface and the rocky cliffs. */
export class World {
  readonly group: Group = new Group();
  private readonly water: WaterSurface;
  private readonly cliffs: Cliffs;

  constructor(options: WorldOptions) {
    this.water = new WaterSurface(options.discRadius);
    this.water.mesh.position.y = WATER_LEVEL_Y;
    this.group.add(this.water.mesh);

    this.cliffs = new Cliffs({
      topRadius: options.discRadius,
      topY: WATER_LEVEL_Y,
      bottomY: options.tableTopY,
    });
    this.group.add(this.cliffs.group);
  }

  update(_dt: number, t: number): void {
    this.water.update(t);
  }

  dispose(): void {
    this.water.dispose();
    this.cliffs.dispose();
  }
}
