import { createBoardTopology, makeTileKey } from './board-topology';
import type { TilePlacement } from './tile-placement';

export interface RobberVictimSettlementInput {
  readonly seat: number;
  readonly vertexId: string;
}

export interface RobberVictimPlayerResourcesInput {
  readonly seat: number;
  readonly totalResourceCards: number;
}

export function collectRobberVictimSeats(
  tiles: readonly TilePlacement[],
  settlements: readonly RobberVictimSettlementInput[],
  players: readonly RobberVictimPlayerResourcesInput[],
  actorSeat: number,
  robberQ: number,
  robberR: number,
): number[] {
  const topology = createBoardTopology(tiles);
  const tileKey = makeTileKey(robberQ, robberR);
  const eligible = new Set<number>();
  for (let i = 0; i < settlements.length; i += 1) {
    const settlement = settlements[i];
    if (settlement.seat === actorSeat) {
      continue;
    }
    const vertex = topology.verticesById.get(settlement.vertexId);
    if (!vertex || !vertex.adjacentTileKeys.includes(tileKey)) {
      continue;
    }
    let total = 0;
    for (let p = 0; p < players.length; p += 1) {
      if (players[p].seat === settlement.seat) {
        total = players[p].totalResourceCards;
        break;
      }
    }
    if (total > 0) {
      eligible.add(settlement.seat);
    }
  }
  return Array.from(eligible).sort((a, b) => a - b);
}
