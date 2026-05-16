import { PlayerSeat, ResourceType } from '@catan/api-interfaces';
import { hexRing } from '@catan/shared-game-field';
import { makeTileKey } from '@catan/shared-game-field';
import { LobbyRuntime } from '../lobby/lobby-runtime';

const HARBOR_HEX_INDICES: readonly number[] = [0, 1, 2, 4, 5, 6, 8, 9, 10];
const HARBOR_PATTERN: readonly { resource: ResourceType | null; ratio: number }[] = [
  { resource: ResourceType.Wood, ratio: 2 },
  { resource: null, ratio: 3 },
  { resource: ResourceType.Wheat, ratio: 2 },
  { resource: null, ratio: 3 },
  { resource: ResourceType.Wool, ratio: 2 },
  { resource: null, ratio: 3 },
  { resource: ResourceType.Brick, ratio: 2 },
  { resource: null, ratio: 3 },
  { resource: ResourceType.Ore, ratio: 2 },
];
const NEIGHBOR_DIRS: readonly { q: number; r: number }[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function resolveHarborRates(
  lobby: LobbyRuntime,
  seat: PlayerSeat,
): Record<ResourceType | 'generic', number> {
  const rates: Record<ResourceType | 'generic', number> = {
    generic: 4,
    [ResourceType.Wood]: 4,
    [ResourceType.Brick]: 4,
    [ResourceType.Wheat]: 4,
    [ResourceType.Wool]: 4,
    [ResourceType.Ore]: 4,
  };
  const harborVertices = getHarborVertexSets(lobby);
  for (let i = 0; i < harborVertices.length; i += 1) {
    const harbor = harborVertices[i];
    const owned = playerOwnsAnyVertex(lobby, seat, harbor.vertexIds);
    if (!owned) {
      continue;
    }
    if (harbor.resource === null) {
      rates.generic = Math.min(rates.generic, harbor.ratio);
    } else {
      rates[harbor.resource] = Math.min(rates[harbor.resource], harbor.ratio);
    }
  }
  for (const resource of Object.values(ResourceType)) {
    if (rates.generic < rates[resource]) {
      rates[resource] = rates.generic;
    }
  }
  return rates;
}

function playerOwnsAnyVertex(
  lobby: LobbyRuntime,
  seat: PlayerSeat,
  vertexIds: readonly string[],
): boolean {
  for (let i = 0; i < lobby.settlements.length; i += 1) {
    const settlement = lobby.settlements[i];
    if (settlement.seat !== seat) {
      continue;
    }
    if (vertexIds.includes(settlement.vertexId)) {
      return true;
    }
  }
  return false;
}

function getHarborVertexSets(
  lobby: LobbyRuntime,
): { vertexIds: readonly string[]; resource: ResourceType | null; ratio: number }[] {
  const ring = hexRing(2);
  const sets: { vertexIds: readonly string[]; resource: ResourceType | null; ratio: number }[] = [];
  for (let i = 0; i < HARBOR_HEX_INDICES.length; i += 1) {
    const ringIndex = HARBOR_HEX_INDICES[i];
    const tile = ring[ringIndex];
    if (!tile) {
      continue;
    }
    const tileKey = makeTileKey(tile.q, tile.r);
    const side = findOuterSideDirection(tile.q, tile.r);
    if (!side) {
      continue;
    }
    const edge = findTileSideEdge(lobby, tileKey, side.q, side.r);
    if (!edge) {
      continue;
    }
    sets.push({
      vertexIds: [edge.aVertexId, edge.bVertexId],
      resource: HARBOR_PATTERN[i].resource,
      ratio: HARBOR_PATTERN[i].ratio,
    });
  }
  return sets;
}

function findOuterSideDirection(q: number, r: number): { q: number; r: number } | null {
  let bestDir: { q: number; r: number } | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < NEIGHBOR_DIRS.length; i += 1) {
    const dir = NEIGHBOR_DIRS[i];
    const neighborQ = q + dir.q;
    const neighborR = r + dir.r;
    const ringDistance = Math.max(
      Math.abs(neighborQ),
      Math.abs(neighborR),
      Math.abs(neighborQ + neighborR),
    );
    if (ringDistance !== 3) {
      continue;
    }
    const score =
      neighborQ * neighborQ +
      neighborR * neighborR +
      (neighborQ + neighborR) * (neighborQ + neighborR);
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

function findTileSideEdge(
  lobby: LobbyRuntime,
  tileKey: string,
  outwardQ: number,
  outwardR: number,
) {
  const [tileQRaw, tileRRaw] = tileKey.split(',');
  const tileQ = Number(tileQRaw);
  const tileR = Number(tileRRaw);
  const neighborKey = makeTileKey(tileQ + outwardQ, tileR + outwardR);
  for (const edge of lobby.edgesById.values()) {
    if (!edge.adjacentTileKeys.includes(tileKey)) {
      continue;
    }
    if (edge.adjacentTileKeys.includes(neighborKey)) {
      continue;
    }
    return edge;
  }
  return undefined;
}
