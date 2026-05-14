import { AxialCoord } from './hex-layout';
import { TileType } from './tile-type';

export interface TilePlacement {
  readonly coord: AxialCoord;
  readonly type: TileType;
  readonly number: number | null;
}
