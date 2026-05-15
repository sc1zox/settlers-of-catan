import { DevCardType, PlayerSeat } from '@catan/api-interfaces';
import { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';

export function getTotalVictoryPoints(player: LobbyPlayerSlot): number {
  let hiddenVictoryCards = 0;
  for (let i = 0; i < player.devCards.length; i += 1) {
    if (player.devCards[i] === DevCardType.VictoryPoint) {
      hiddenVictoryCards += 1;
    }
  }
  let bonus = 0;
  if (player.hasLongestRoad) {
    bonus += 2;
  }
  if (player.hasLargestArmy) {
    bonus += 2;
  }
  return player.visibleVictoryPoints + hiddenVictoryCards + bonus;
}

export function recomputeWinner(lobby: LobbyRuntime): void {
  if (lobby.winnerSeat !== null) {
    return;
  }
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    if (getTotalVictoryPoints(player) >= 10) {
      lobby.winnerSeat = player.seat;
      return;
    }
  }
}

/**
 * Single end-of-action scoring pass: refresh longest-road / largest-army,
 * recompute the winner, and lock the FSM into Finished if anyone hit 10 VP.
 *
 * Centralized so every state-mutating handler ends with the same scoring
 * order, and so the Finished transition lives in exactly one place.
 */
export function applyPostActionScoring(lobby: LobbyRuntime): void {
  recomputeLongestRoad(lobby);
  recomputeLargestArmy(lobby);
  recomputeWinner(lobby);
  if (lobby.winnerSeat !== null) {
    lobby.fsm.onWinnerDeclared();
  }
}

export function recomputeLargestArmy(lobby: LobbyRuntime): void {
  let bestSeat: PlayerSeat | null = null;
  let bestCount = 2;
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    if (player.playedKnights > bestCount) {
      bestCount = player.playedKnights;
      bestSeat = player.seat;
    }
  }
  lobby.largestArmySeat = bestSeat;
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    player.hasLargestArmy = bestSeat !== null && player.seat === bestSeat;
  }
}

export function recomputeLongestRoad(lobby: LobbyRuntime): void {
  let bestSeat: PlayerSeat | null = null;
  let bestLength = 4;
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    const length = computeLongestRoadForSeat(lobby, player.seat);
    player.longestRoadLength = length;
    if (length > bestLength) {
      bestLength = length;
      bestSeat = player.seat;
    }
  }
  lobby.longestRoadSeat = bestSeat;
  for (let i = 0; i < lobby.players.length; i += 1) {
    const player = lobby.players[i];
    player.hasLongestRoad = bestSeat !== null && player.seat === bestSeat;
  }
}

function computeLongestRoadForSeat(lobby: LobbyRuntime, seat: PlayerSeat): number {
  const roadEdgeIds: string[] = [];
  for (let i = 0; i < lobby.roads.length; i += 1) {
    if (lobby.roads[i].seat === seat) {
      roadEdgeIds.push(lobby.roads[i].edgeId);
    }
  }
  let best = 0;
  for (let i = 0; i < roadEdgeIds.length; i += 1) {
    const edgeId = roadEdgeIds[i];
    const edge = lobby.edgesById.get(edgeId);
    if (!edge) {
      continue;
    }
    const visited = new Set<string>();
    const fromA = walkRoadDepth(lobby, seat, edge.aVertexId, edgeId, visited);
    const visitedB = new Set<string>();
    const fromB = walkRoadDepth(lobby, seat, edge.bVertexId, edgeId, visitedB);
    if (fromA > best) {
      best = fromA;
    }
    if (fromB > best) {
      best = fromB;
    }
  }
  return best;
}

function walkRoadDepth(
  lobby: LobbyRuntime,
  seat: PlayerSeat,
  currentVertexId: string,
  viaEdgeId: string,
  visitedEdges: Set<string>,
): number {
  visitedEdges.add(viaEdgeId);
  let best = visitedEdges.size;
  if (isBlockedVertex(lobby, seat, currentVertexId)) {
    visitedEdges.delete(viaEdgeId);
    return best;
  }
  const vertex = lobby.verticesById.get(currentVertexId);
  if (!vertex) {
    visitedEdges.delete(viaEdgeId);
    return best;
  }
  for (let i = 0; i < vertex.edgeIds.length; i += 1) {
    const nextEdgeId = vertex.edgeIds[i];
    if (visitedEdges.has(nextEdgeId)) {
      continue;
    }
    if (!isRoadOwnedBySeat(lobby, nextEdgeId, seat)) {
      continue;
    }
    const nextEdge = lobby.edgesById.get(nextEdgeId);
    if (!nextEdge) {
      continue;
    }
    const nextVertexId =
      nextEdge.aVertexId === currentVertexId ? nextEdge.bVertexId : nextEdge.aVertexId;
    const branchVisited = new Set<string>(visitedEdges);
    const branchBest = walkRoadDepth(lobby, seat, nextVertexId, nextEdgeId, branchVisited);
    if (branchBest > best) {
      best = branchBest;
    }
  }
  visitedEdges.delete(viaEdgeId);
  return best;
}

function isRoadOwnedBySeat(lobby: LobbyRuntime, edgeId: string, seat: PlayerSeat): boolean {
  for (let i = 0; i < lobby.roads.length; i += 1) {
    const road = lobby.roads[i];
    if (road.edgeId === edgeId && road.seat === seat) {
      return true;
    }
  }
  return false;
}

function isBlockedVertex(lobby: LobbyRuntime, seat: PlayerSeat, vertexId: string): boolean {
  for (let i = 0; i < lobby.settlements.length; i += 1) {
    const settlement = lobby.settlements[i];
    if (settlement.vertexId === vertexId && settlement.seat !== seat) {
      return true;
    }
  }
  return false;
}
