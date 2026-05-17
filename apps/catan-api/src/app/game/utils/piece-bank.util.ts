import { ActionRejectCode, PieceBankLimit, PlayerSeat } from '@catan/api-interfaces';
import { LobbyRuntime } from '../lobby/lobby-runtime';

export function countRoadsForSeat(lobby: LobbyRuntime, seat: PlayerSeat): number {
  let count = 0;
  for (let i = 0; i < lobby.roads.length; i += 1) {
    if (lobby.roads[i].seat === seat) {
      count += 1;
    }
  }
  return count;
}

export function countSettlementsForSeat(lobby: LobbyRuntime, seat: PlayerSeat): number {
  let count = 0;
  for (let i = 0; i < lobby.settlements.length; i += 1) {
    if (lobby.settlements[i].seat === seat) {
      count += 1;
    }
  }
  return count;
}

export function countCitiesForSeat(lobby: LobbyRuntime, seat: PlayerSeat): number {
  let count = 0;
  for (let i = 0; i < lobby.settlements.length; i += 1) {
    const settlement = lobby.settlements[i];
    if (settlement.seat === seat && settlement.isCity) {
      count += 1;
    }
  }
  return count;
}

export function assertRoadPieceAvailable(lobby: LobbyRuntime, seat: PlayerSeat): void {
  if (countRoadsForSeat(lobby, seat) >= PieceBankLimit.RoadsPerPlayer) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
}

export function assertSettlementPieceAvailable(lobby: LobbyRuntime, seat: PlayerSeat): void {
  if (countSettlementsForSeat(lobby, seat) >= PieceBankLimit.SettlementsPerPlayer) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
}

export function assertCityPieceAvailable(lobby: LobbyRuntime, seat: PlayerSeat): void {
  if (countCitiesForSeat(lobby, seat) >= PieceBankLimit.CitiesPerPlayer) {
    throw new Error(ActionRejectCode.IllegalPlacement);
  }
}
