import type { TilePlacement } from './tile-placement';

interface CubeCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface IntCubeCoord {
  readonly x2: number;
  readonly y2: number;
  readonly z2: number;
}

export interface BoardVertexRuntime {
  id: string;
  adjacentTileKeys: string[];
  edgeIds: string[];
  neighborVertexIds: string[];
}

export interface BoardEdgeRuntime {
  id: string;
  aVertexId: string;
  bVertexId: string;
  adjacentTileKeys: string[];
}

export interface BoardTopologyRuntime {
  verticesById: Map<string, BoardVertexRuntime>;
  edgesById: Map<string, BoardEdgeRuntime>;
}

export const CORNER_OFFSETS: readonly IntCubeCoord[] = Object.freeze([
  { x2: 1, y2: 1, z2: -2 },
  { x2: 2, y2: -1, z2: -1 },
  { x2: 1, y2: -2, z2: 1 },
  { x2: -1, y2: -1, z2: 2 },
  { x2: -2, y2: 1, z2: 1 },
  { x2: -1, y2: 2, z2: -1 },
]);

export function createBoardTopology(tiles: readonly TilePlacement[]): BoardTopologyRuntime {
  const verticesById = new Map<string, BoardVertexRuntime>();
  const edgesById = new Map<string, BoardEdgeRuntime>();
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i];
    const tileKey = makeTileKey(tile.coord.q, tile.coord.r);
    const center = axialToCube(tile.coord.q, tile.coord.r);
    const centerInt = {
      x2: center.x * 3,
      y2: center.y * 3,
      z2: center.z * 3,
    };
    const vertexIds: string[] = [];
    for (let cornerIndex = 0; cornerIndex < CORNER_OFFSETS.length; cornerIndex += 1) {
      const offset = CORNER_OFFSETS[cornerIndex];
      const vertexId = makeVertexId(
        centerInt.x2 + offset.x2,
        centerInt.y2 + offset.y2,
        centerInt.z2 + offset.z2,
      );
      vertexIds.push(vertexId);
      let vertex = verticesById.get(vertexId);
      if (!vertex) {
        vertex = {
          id: vertexId,
          adjacentTileKeys: [],
          edgeIds: [],
          neighborVertexIds: [],
        };
        verticesById.set(vertexId, vertex);
      }
      if (!vertex.adjacentTileKeys.includes(tileKey)) {
        vertex.adjacentTileKeys.push(tileKey);
      }
    }
    for (let cornerIndex = 0; cornerIndex < vertexIds.length; cornerIndex += 1) {
      const aVertexId = vertexIds[cornerIndex];
      const bVertexId = vertexIds[(cornerIndex + 1) % vertexIds.length];
      const edgeId = makeEdgeId(aVertexId, bVertexId);
      let edge = edgesById.get(edgeId);
      if (!edge) {
        edge = {
          id: edgeId,
          aVertexId: edgeId.split('|')[0],
          bVertexId: edgeId.split('|')[1],
          adjacentTileKeys: [],
        };
        edgesById.set(edgeId, edge);
      }
      if (!edge.adjacentTileKeys.includes(tileKey)) {
        edge.adjacentTileKeys.push(tileKey);
      }
    }
  }
  for (const edge of edgesById.values()) {
    const aVertex = verticesById.get(edge.aVertexId);
    const bVertex = verticesById.get(edge.bVertexId);
    if (!aVertex || !bVertex) {
      continue;
    }
    if (!aVertex.edgeIds.includes(edge.id)) {
      aVertex.edgeIds.push(edge.id);
    }
    if (!bVertex.edgeIds.includes(edge.id)) {
      bVertex.edgeIds.push(edge.id);
    }
    if (!aVertex.neighborVertexIds.includes(bVertex.id)) {
      aVertex.neighborVertexIds.push(bVertex.id);
    }
    if (!bVertex.neighborVertexIds.includes(aVertex.id)) {
      bVertex.neighborVertexIds.push(aVertex.id);
    }
  }
  return { verticesById, edgesById };
}

function axialToCube(q: number, r: number): CubeCoord {
  return {
    x: q,
    z: r,
    y: -q - r,
  };
}

export function makeTileKey(q: number, r: number): string {
  return `${q},${r}`;
}

function makeVertexId(x2: number, y2: number, z2: number): string {
  return `${x2},${y2},${z2}`;
}

function makeEdgeId(aVertexId: string, bVertexId: string): string {
  if (aVertexId < bVertexId) {
    return `${aVertexId}|${bVertexId}`;
  }
  return `${bVertexId}|${aVertexId}`;
}
