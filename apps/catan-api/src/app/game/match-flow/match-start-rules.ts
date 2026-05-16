import type { LobbyRuntime } from '../lobby/lobby-runtime';

const MINIMUM_PLAYER_COUNT_TO_START_LOBBY = 3;

export function getMinimumPlayerCountToStartLobby(lobby: LobbyRuntime): number {
  void lobby;
  return MINIMUM_PLAYER_COUNT_TO_START_LOBBY;
}
