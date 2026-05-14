import { TilePlacement } from './tile-placement';

export interface GameBoardLayout {
  readonly seed: number;
  readonly tiles: readonly TilePlacement[];
}
