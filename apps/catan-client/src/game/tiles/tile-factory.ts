import { Vector3 } from 'three';
import { TilePlacement, TileType } from '@catan/shared-game-field';
import { axialToWorld } from '../board/hex';
import { DesertTile } from './desert-tile';
import { FieldsTile } from './fields-tile';
import { ForestTile } from './forest-tile';
import { HillsTile } from './hills-tile';
import { MountainsTile } from './mountains-tile';
import { PastureTile } from './pasture-tile';
import { Tile } from './tile';
import { WaterTile } from './water-tile';

export function createTile(placement: TilePlacement): Tile {
  const position: Vector3 = axialToWorld(placement.coord);
  const init = {
    coord: placement.coord,
    type: placement.type,
    position,
    number: placement.number,
  };
  switch (placement.type) {
    case TileType.Forest:
      return new ForestTile(init);
    case TileType.Fields:
      return new FieldsTile(init);
    case TileType.Pasture:
      return new PastureTile(init);
    case TileType.Hills:
      return new HillsTile(init);
    case TileType.Mountains:
      return new MountainsTile(init);
    case TileType.Desert:
      return new DesertTile(init);
    case TileType.Water:
      return new WaterTile(init);
  }
}
