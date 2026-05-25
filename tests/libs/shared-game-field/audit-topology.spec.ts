import {
  createBoardTopology,
  makeStandardLandPlacements,
} from '@catan/shared-game-field';

describe('createBoardTopology', () => {
  const tiles = makeStandardLandPlacements(42);
  const { verticesById, edgesById } = createBoardTopology(tiles);

  it('produces a 54-vertex / 72-edge standard board', () => {
    expect(verticesById.size).toBe(54);
    expect(edgesById.size).toBe(72);
  });

  it('keeps every neighbor relation mutual', () => {
    for (const [vid, v] of verticesById) {
      for (const nvid of v.neighborVertexIds) {
        const n = verticesById.get(nvid);
        expect(n).toBeDefined();
        expect(n!.neighborVertexIds).toContain(vid);
      }
    }
  });

  it('keeps every vertex degree within 2..3', () => {
    for (const v of verticesById.values()) {
      expect(v.neighborVertexIds.length).toBeGreaterThanOrEqual(2);
      expect(v.neighborVertexIds.length).toBeLessThanOrEqual(3);
      expect(v.edgeIds.length).toBe(v.neighborVertexIds.length);
    }
  });

  it('links each edge to its two endpoint vertices via edgeIds', () => {
    for (const [, e] of edgesById) {
      const a = verticesById.get(e.aVertexId);
      const b = verticesById.get(e.bVertexId);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(a!.edgeIds).toContain(e.id);
      expect(b!.edgeIds).toContain(e.id);
      expect(a!.neighborVertexIds).toContain(e.bVertexId);
      expect(b!.neighborVertexIds).toContain(e.aVertexId);
    }
  });
});
