import { HarborVertexSet, PlayerHarborRatesDto, PlayerSeat, ResourceType } from '@catan/api-interfaces';
import { CORNER_OFFSETS, hexRing } from '@catan/shared-game-field';
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
  harborSets: readonly HarborVertexSet[] = computeHarborVertexSets(lobby),
): PlayerHarborRatesDto {
  let generic = 4;
  const perResource: Record<ResourceType, number> = {
    [ResourceType.Wood]: 4,
    [ResourceType.Brick]: 4,
    [ResourceType.Wheat]: 4,
    [ResourceType.Wool]: 4,
    [ResourceType.Ore]: 4,
  };
  const harborVertices = harborSets;
  for (let i = 0; i < harborVertices.length; i += 1) {
    const harbor = harborVertices[i];
    const owned = playerOwnsAnyVertex(lobby, seat, harbor.vertexIds);
    if (!owned) {
      continue;
    }
    if (harbor.resource === null) {
      generic = Math.min(generic, harbor.ratio);
    } else {
      perResource[harbor.resource] = Math.min(perResource[harbor.resource], harbor.ratio);
    }
  }
  for (const resource of Object.values(ResourceType)) {
    if (generic < perResource[resource]) {
      perResource[resource] = generic;
    }
  }
  return { generic, perResource };
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

export function computeHarborVertexSets(lobby: LobbyRuntime): HarborVertexSet[] {
  const ring = hexRing(2);
  const sets: { vertexIds: readonly string[]; resource: ResourceType | null; ratio: number }[] = [];
  for (let i = 0; i < HARBOR_HEX_INDICES.length; i += 1) {
    const ringIndex = HARBOR_HEX_INDICES[i];
    const tile = ring[ringIndex];
    if (!tile) {
      continue;
    }
    const side = findOuterSideDirection(tile.q, tile.r);
    if (!side) {
      continue;
    }
    const vertexIds = computeOuterEdgeVertexIds(lobby, tile.q, tile.r, side.q, side.r);
    if (!vertexIds) {
      continue;
    }
    sets.push({
      vertexIds,
      resource: HARBOR_PATTERN[i].resource,
      ratio: HARBOR_PATTERN[i].ratio,
    });
  }
  return sets;
}

// Returns the neighbor direction whose neighbor hex lies at ring distance 3 (outermost ring).
// The score is the squared axial magnitude (q²+r²+(q+r)²), which is maximized exactly on ring 3.
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

function computeOuterEdgeVertexIds(
  lobby: LobbyRuntime,
  tileQ: number,
  tileR: number,
  outwardQ: number,
  outwardR: number,
): [string, string] | null {
  const centerX2 = tileQ * 3;
  const centerY2 = (-tileQ - tileR) * 3;
  const centerZ2 = tileR * 3;
  const dirX = outwardQ;
  const dirY = -outwardQ - outwardR;
  const dirZ = outwardR;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondScore = Number.NEGATIVE_INFINITY;
  let bestId: string | null = null;
  let secondId: string | null = null;
  for (let i = 0; i < CORNER_OFFSETS.length; i += 1) {
    const offset = CORNER_OFFSETS[i];
    const score = offset.x2 * dirX + offset.y2 * dirY + offset.z2 * dirZ;
    const vertexId = `${centerX2 + offset.x2},${centerY2 + offset.y2},${centerZ2 + offset.z2}`;
    if (score > bestScore) {
      secondScore = bestScore;
      secondId = bestId;
      bestScore = score;
      bestId = vertexId;
    } else if (score > secondScore) {
      secondScore = score;
      secondId = vertexId;
    }
  }
  if (!bestId || !secondId) {
    return null;
  }
  if (!lobby.verticesById.has(bestId) || !lobby.verticesById.has(secondId)) {
    return null;
  }
  return [bestId, secondId];
}
