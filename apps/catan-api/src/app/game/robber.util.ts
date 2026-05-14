import { ActionRejectCode, PlayerSeat, ResourceType, TileType } from '@catan/api-interfaces';
import { LobbyPlayerSlot, LobbyRuntime } from './lobby-runtime';

export function applyRobberMove(
  lobby: LobbyRuntime,
  actor: LobbyPlayerSlot,
  q: number,
  r: number,
  victimSeat: PlayerSeat | undefined,
): void {
  const tile = lobby.tiles.find((placement) => placement.coord.q === q && placement.coord.r === r);
  if (!tile || tile.type === TileType.Water) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
  const oldQ = lobby.robberCoord.q;
  const oldR = lobby.robberCoord.r;
  if (oldQ === q && oldR === r) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
  lobby.robberCoord = { q, r };
  const eligibleVictims = collectRobberVictims(lobby, actor.seat, q, r);
  if (eligibleVictims.length === 0) {
    return;
  }
  if (victimSeat === undefined) {
    throw new Error(ActionRejectCode.VictimRequired);
  }
  const victim = eligibleVictims.find((candidate) => candidate.seat === victimSeat);
  if (!victim) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
  stealRandomResource(victim, actor);
}

function collectRobberVictims(
  lobby: LobbyRuntime,
  actorSeat: PlayerSeat,
  q: number,
  r: number,
): LobbyPlayerSlot[] {
  const tileKey = `${q},${r}`;
  const victims: LobbyPlayerSlot[] = [];
  for (let i = 0; i < lobby.players.length; i += 1) {
    const candidate = lobby.players[i];
    if (candidate.seat === actorSeat) {
      continue;
    }
    if (countTotalResources(candidate) === 0) {
      continue;
    }
    if (!playerHasSettlementOnTile(lobby, candidate.seat, tileKey)) {
      continue;
    }
    victims.push(candidate);
  }
  return victims;
}

function playerHasSettlementOnTile(
  lobby: LobbyRuntime,
  seat: PlayerSeat,
  tileKey: string,
): boolean {
  for (let i = 0; i < lobby.settlements.length; i += 1) {
    const settlement = lobby.settlements[i];
    if (settlement.seat !== seat) {
      continue;
    }
    const vertex = lobby.verticesById.get(settlement.vertexId);
    if (!vertex) {
      continue;
    }
    if (vertex.adjacentTileKeys.includes(tileKey)) {
      return true;
    }
  }
  return false;
}

function countTotalResources(player: LobbyPlayerSlot): number {
  const keys = Object.values(ResourceType);
  let total = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    total += player.resources[key] ?? 0;
  }
  return total;
}

function stealRandomResource(from: LobbyPlayerSlot, to: LobbyPlayerSlot): void {
  const owned: ResourceType[] = [];
  const resourceKeys = Object.values(ResourceType);
  for (let i = 0; i < resourceKeys.length; i += 1) {
    const resource = resourceKeys[i];
    const amount = from.resources[resource] ?? 0;
    for (let count = 0; count < amount; count += 1) {
      owned.push(resource);
    }
  }
  if (owned.length === 0) {
    return;
  }
  const randomIndex = Math.floor(Math.random() * owned.length);
  const stolen = owned[randomIndex];
  from.resources[stolen] = (from.resources[stolen] ?? 0) - 1;
  to.resources[stolen] = (to.resources[stolen] ?? 0) + 1;
}
