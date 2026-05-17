import { GamePhase, LobbyFullStatePayload, PlayerSeat } from '@catan/api-interfaces';
import { TranslateInstantFn } from '../../../shared/i18n/translate-instant-fn';
import { EnumTranslate } from '../../../game/i18n/enum-translate.helper';
import { LobbySeatUiState, LobbyUiState } from './lobby-ui-state';

export function seatLabel(seat: PlayerSeat, instant: TranslateInstantFn): string {
  return EnumTranslate.translateSeat(instant, seat);
}

export function phaseLabel(phase: GamePhase, instant: TranslateInstantFn): string {
  return EnumTranslate.translatePhase(instant, phase);
}

export function displayNameForSeat(
  payload: LobbyFullStatePayload,
  seat: PlayerSeat,
  instant: TranslateInstantFn,
): string {
  const player = payload.players.find((candidate) => candidate.seat === seat);
  return player?.displayName ?? seatLabel(seat, instant);
}

export function robberDiscardDisplayNames(
  raw: LobbyFullStatePayload,
  ui: LobbyUiState,
  instant: TranslateInstantFn,
): string[] {
  const names: string[] = [];
  for (let i = 0; i < ui.pendingRobberDiscardSeats.length; i += 1) {
    const seat = ui.pendingRobberDiscardSeats[i];
    names.push(displayNameForSeat(raw, seat, instant));
  }
  return names;
}

export function mapLobbyFullStateToUiState(
  payload: LobbyFullStatePayload,
  instant: TranslateInstantFn,
): LobbyUiState {
  const seats: LobbySeatUiState[] = [];
  const seatOrder: PlayerSeat[] = [
    PlayerSeat.North,
    PlayerSeat.East,
    PlayerSeat.South,
    PlayerSeat.West,
  ];
  for (let index = 0; index < seatOrder.length; index += 1) {
    const seat = seatOrder[index];
    const matchingPlayer = payload.players.find((candidate) => candidate.seat === seat);
    const playerName =
      matchingPlayer?.displayName ?? EnumTranslate.translateLobbyWaitingForPlayer(instant);
    seats.push({
      seat,
      seatLabel: seatLabel(seat, instant),
      playerName,
      isConnected: matchingPlayer?.isConnected ?? false,
      isSelf: matchingPlayer?.isSelf ?? false,
    });
  }
  return {
    lobbyId: payload.lobbyId,
    lobbyCode: payload.lobbyCode,
    phase: payload.phase,
    activeSeat: payload.currentSeat,
    adminSeat: payload.adminSeat,
    pendingRobberDiscardSeats: payload.pendingRobberDiscardSeats,
    pendingSetupRoadSeat: payload.pendingSetupRoadSeat,
    pendingSetupRoadFromVertexId: payload.pendingSetupRoadFromVertexId,
    vertexIds: payload.vertexIds,
    edgeIds: payload.edgeIds,
    longestRoadSeat: payload.longestRoadSeat,
    largestArmySeat: payload.largestArmySeat,
    winnerSeat: payload.winnerSeat,
    seats,
  };
}
