import { DevCardType, GamePhase, PlayerSeat } from '@catan/api-interfaces';
import { LobbyRuntime } from '@catan/api-app/app/game/lobby/lobby-runtime';
import {
  applyPostActionScoring,
  getTotalVictoryPoints,
} from '@catan/api-app/app/game/utils/scoring.util';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLobby(): LobbyRuntime {
  return new LobbyRuntime('test-lobby', 'TEST');
}

/**
 * Walk the board topology to extract a chain of up to `length` connected edges.
 * The hex board's minimum cycle length is 6 edges, so extracting ≤5 edges is
 * guaranteed to produce an acyclic (linear) path.
 *
 * Returns edge ids and the full vertex sequence:
 *   vertices[i] is the vertex between edges[i-1] and edges[i];
 *   vertices[0] is the start of edges[0]; vertices[edges.length] is the far end.
 */
function extractEdgeChain(
  lobby: LobbyRuntime,
  length: number,
): { edges: string[]; vertices: string[] } {
  const edges: string[] = [];
  const vertices: string[] = [];
  const usedEdges = new Set<string>();

  const firstEntry = lobby.edgesById.values().next();
  if (firstEntry.done || !firstEntry.value) return { edges, vertices };
  const firstEdge = firstEntry.value;

  edges.push(firstEdge.id);
  usedEdges.add(firstEdge.id);
  vertices.push(firstEdge.aVertexId);
  let currentVertex = firstEdge.bVertexId;
  vertices.push(currentVertex);

  while (edges.length < length) {
    const vertex = lobby.verticesById.get(currentVertex);
    if (!vertex) break;
    let advanced = false;
    for (let i = 0; i < vertex.edgeIds.length; i += 1) {
      const eId = vertex.edgeIds[i];
      if (!usedEdges.has(eId)) {
        const edge = lobby.edgesById.get(eId);
        if (!edge) continue;
        edges.push(eId);
        usedEdges.add(eId);
        currentVertex = edge.aVertexId === currentVertex ? edge.bVertexId : edge.aVertexId;
        vertices.push(currentVertex);
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }

  return { edges, vertices };
}

function addPlayer(lobby: LobbyRuntime, token: string): void {
  lobby.addPlayer(token, 'Test Player', null, false);
}

// ---------------------------------------------------------------------------
// getTotalVictoryPoints
// ---------------------------------------------------------------------------

describe('getTotalVictoryPoints', () => {
  it('counts visible VPs only when no bonuses', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const player = lobby.players[0];
    player.visibleVictoryPoints = 3;
    expect(getTotalVictoryPoints(player)).toBe(3);
  });

  it('adds 1 per VictoryPoint dev card (hidden)', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const player = lobby.players[0];
    player.visibleVictoryPoints = 2;
    player.devCards.push(DevCardType.VictoryPoint, DevCardType.VictoryPoint);
    expect(getTotalVictoryPoints(player)).toBe(4);
  });

  it('adds 2 for hasLongestRoad', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const player = lobby.players[0];
    player.visibleVictoryPoints = 4;
    player.hasLongestRoad = true;
    expect(getTotalVictoryPoints(player)).toBe(6);
  });

  it('adds 2 for hasLargestArmy', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const player = lobby.players[0];
    player.visibleVictoryPoints = 4;
    player.hasLargestArmy = true;
    expect(getTotalVictoryPoints(player)).toBe(6);
  });

  it('stacks visible VPs + dev card VPs + both bonuses', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const player = lobby.players[0];
    player.visibleVictoryPoints = 5;
    player.devCards.push(DevCardType.VictoryPoint);
    player.hasLongestRoad = true;
    player.hasLargestArmy = true;
    expect(getTotalVictoryPoints(player)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Longest Road
// ---------------------------------------------------------------------------

describe('Longest Road (recomputeLongestRoad via applyPostActionScoring)', () => {
  it('awards longest road only when chain reaches 5 or more edges', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const north = lobby.players[0];
    // 5 edges are guaranteed linear (hex min-cycle = 6)
    const { edges } = extractEdgeChain(lobby, 5);
    expect(edges.length).toBe(5);

    // 4 roads → no award
    for (let i = 0; i < 4; i += 1) {
      lobby.roads.push({ seat: north.seat, edgeId: edges[i] });
    }
    applyPostActionScoring(lobby);
    expect(lobby.longestRoadSeat).toBeNull();
    expect(north.hasLongestRoad).toBe(false);

    // 5th road → award
    lobby.roads.push({ seat: north.seat, edgeId: edges[4] });
    lobby.longestRoadSeat = null;
    applyPostActionScoring(lobby);
    expect(lobby.longestRoadSeat).toBe(north.seat);
    expect(north.hasLongestRoad).toBe(true);
  });

  it('opponent settlement at a junction blocks the road walk', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    addPlayer(lobby, 'tok-e');
    const north = lobby.players[0];
    const east = lobby.players[1];

    // 4 edges are guaranteed acyclic (hex min-cycle = 6)
    const { edges, vertices } = extractEdgeChain(lobby, 4);
    expect(edges.length).toBe(4);

    for (let i = 0; i < 4; i += 1) {
      lobby.roads.push({ seat: north.seat, edgeId: edges[i] });
    }

    applyPostActionScoring(lobby);
    expect(north.longestRoadLength).toBe(4);

    // East places a settlement at the junction between edge[1] and edge[2],
    // splitting North's chain into two halves of 2 edges each.
    lobby.settlements.push({ seat: east.seat, vertexId: vertices[2], isCity: false });
    applyPostActionScoring(lobby);
    expect(north.longestRoadLength).toBe(2);
  });

  it('incumbent keeps Longest Road on a tie — does not transfer', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    addPlayer(lobby, 'tok-e');
    const north = lobby.players[0];
    const east = lobby.players[1];

    // Split a 10-edge chain into two non-overlapping 5-edge sub-chains.
    // Each 5-edge sub-chain is guaranteed linear (5 < 6 min-cycle).
    const { edges } = extractEdgeChain(lobby, 10);
    expect(edges.length).toBeGreaterThanOrEqual(10);

    const northEdges = edges.slice(0, 5);
    const eastEdges = edges.slice(5, 10);

    // North builds first — becomes the Longest Road holder.
    for (let i = 0; i < northEdges.length; i += 1) {
      lobby.roads.push({ seat: north.seat, edgeId: northEdges[i] });
    }
    applyPostActionScoring(lobby);
    expect(lobby.longestRoadSeat).toBe(north.seat);

    // East matches North's length — incumbent (North) must keep the bonus.
    for (let i = 0; i < eastEdges.length; i += 1) {
      lobby.roads.push({ seat: east.seat, edgeId: eastEdges[i] });
    }
    applyPostActionScoring(lobby);
    expect(lobby.longestRoadSeat).toBe(north.seat);
    expect(north.hasLongestRoad).toBe(true);
    expect(east.hasLongestRoad).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Largest Army
// ---------------------------------------------------------------------------

describe('Largest Army (recomputeLargestArmy via applyPostActionScoring)', () => {
  it('does not award Largest Army below 3 played knights', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const north = lobby.players[0];
    north.playedKnights = 2;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBeNull();
    expect(north.hasLargestArmy).toBe(false);
  });

  it('awards Largest Army at exactly 3 played knights', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const north = lobby.players[0];
    north.playedKnights = 3;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBe(north.seat);
    expect(north.hasLargestArmy).toBe(true);
  });

  it('transfers Largest Army when a challenger strictly exceeds the holder', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    addPlayer(lobby, 'tok-e');
    const north = lobby.players[0];
    const east = lobby.players[1];

    north.playedKnights = 3;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBe(north.seat);

    east.playedKnights = 4;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBe(east.seat);
    expect(east.hasLargestArmy).toBe(true);
    expect(north.hasLargestArmy).toBe(false);
  });

  it('incumbent keeps Largest Army on a tie — does not transfer', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    addPlayer(lobby, 'tok-e');
    const north = lobby.players[0];
    const east = lobby.players[1];

    north.playedKnights = 3;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBe(north.seat);

    east.playedKnights = 3;
    applyPostActionScoring(lobby);
    expect(lobby.largestArmySeat).toBe(north.seat);
    expect(north.hasLargestArmy).toBe(true);
    expect(east.hasLargestArmy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Win Condition
// ---------------------------------------------------------------------------

describe('Win condition (recomputeWinner via applyPostActionScoring)', () => {
  it('does not set winner below 10 VP', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    lobby.players[0].visibleVictoryPoints = 9;
    applyPostActionScoring(lobby);
    expect(lobby.winnerSeat).toBeNull();
  });

  it('sets winnerSeat and transitions FSM to Finished at exactly 10 VP', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const north = lobby.players[0];
    north.visibleVictoryPoints = 10;
    applyPostActionScoring(lobby);
    expect(lobby.winnerSeat).toBe(north.seat);
    expect(lobby.fsm.getPhase()).toBe(GamePhase.Finished);
  });

  it('counts hidden VictoryPoint dev cards toward the 10-VP win condition', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    const north = lobby.players[0];
    north.visibleVictoryPoints = 8;
    north.devCards.push(DevCardType.VictoryPoint, DevCardType.VictoryPoint);
    applyPostActionScoring(lobby);
    expect(lobby.winnerSeat).toBe(north.seat);
  });

  it('is idempotent — winnerSeat does not change after it is first set', () => {
    const lobby = makeLobby();
    addPlayer(lobby, 'tok-n');
    addPlayer(lobby, 'tok-e');
    const north = lobby.players[0];
    const east = lobby.players[1];

    north.visibleVictoryPoints = 10;
    applyPostActionScoring(lobby);
    expect(lobby.winnerSeat).toBe(north.seat);

    // East also reaches 10 VP — winner must remain North (set first).
    east.visibleVictoryPoints = 10;
    applyPostActionScoring(lobby);
    expect(lobby.winnerSeat).toBe(north.seat);
  });
});
