import { ActionRejectCode, PlayerSeat, ResourceType, TileType } from '@catan/api-interfaces';
import { collectRobberVictimSeats } from '@catan/shared-game-field';
import { LobbyPlayerSlot, LobbyRuntime } from '../lobby/lobby-runtime';

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
    throw new Error(ActionRejectCode.RobberSameTile);
  }
  const eligibleVictims = collectRobberVictims(lobby, actor.seat, q, r);
  let stealVictim: LobbyPlayerSlot | undefined;
  if (eligibleVictims.length > 0) {
    if (victimSeat === undefined) {
      throw new Error(ActionRejectCode.VictimRequired);
    }
    stealVictim = eligibleVictims.find((candidate) => candidate.seat === victimSeat);
    if (!stealVictim) {
      throw new Error(ActionRejectCode.IllegalPlacement);
    }
  }
  lobby.robberCoord = { q, r };
  if (stealVictim !== undefined) {
    stealRandomResource(stealVictim, actor);
  }
}

function collectRobberVictims(
  lobby: LobbyRuntime,
  actorSeat: PlayerSeat,
  q: number,
  r: number,
): LobbyPlayerSlot[] {
  const seats = collectRobberVictimSeats(
    lobby.tiles,
    lobby.settlements.map((s) => ({ seat: s.seat, vertexId: s.vertexId })),
    lobby.players.map((p) => ({
      seat: p.seat,
      totalResourceCards: countTotalResources(p),
    })),
    actorSeat,
    q,
    r,
  );
  const victims: LobbyPlayerSlot[] = [];
  for (let i = 0; i < seats.length; i += 1) {
    const seat = seats[i] as PlayerSeat;
    const found = lobby.players.find((p) => p.seat === seat);
    if (found) {
      victims.push(found);
    }
  }
  return victims;
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
