import {
  collectRobberVictimSeats,
  createBoardTopology,
  makeStandardLandPlacements,
  makeTileKey,
} from '@catan/shared-game-field';

describe('collectRobberVictimSeats', () => {
  it('returns empty when no settlement is on the robber tile', () => {
    const tiles = makeStandardLandPlacements(3);
    const victims = collectRobberVictimSeats(
      tiles,
      [{ seat: 1, vertexId: 'missing-vertex' }],
      [{ seat: 1, totalResourceCards: 4 }],
      0,
      0,
      0,
    );
    expect(victims).toEqual([]);
  });

  it('excludes the actor and opponents without cards', () => {
    const tiles = makeStandardLandPlacements(11);
    const robberQ = 1;
    const robberR = 0;
    const tileKey = makeTileKey(robberQ, robberR);
    const topology = createBoardTopology(tiles);
    let victimVertexId: string | null = null;
    for (const vertex of topology.verticesById.values()) {
      if (vertex.adjacentTileKeys.includes(tileKey)) {
        victimVertexId = vertex.id;
        break;
      }
    }
    expect(victimVertexId).not.toBeNull();
    if (victimVertexId === null) {
      return;
    }
    const victims = collectRobberVictimSeats(
      tiles,
      [
        { seat: 0, vertexId: victimVertexId },
        { seat: 1, vertexId: victimVertexId },
        { seat: 2, vertexId: victimVertexId },
      ],
      [
        { seat: 0, totalResourceCards: 2 },
        { seat: 1, totalResourceCards: 0 },
        { seat: 2, totalResourceCards: 4 },
      ],
      0,
      robberQ,
      robberR,
    );
    expect(victims).toEqual([2]);
  });
});
