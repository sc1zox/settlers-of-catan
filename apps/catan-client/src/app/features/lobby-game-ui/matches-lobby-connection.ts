import { normalizeLobbyCode } from '@catan/api-interfaces';
import type { LobbyConnectionParams } from '../../core/game/lobby-connection-params';

export function matchesLobbyConnection(
  canonicalLobbyId: string,
  lobbyCode: string,
  params: LobbyConnectionParams,
): boolean {
  if (params.lobbyId.length > 0) {
    return canonicalLobbyId === params.lobbyId;
  }
  return normalizeLobbyCode(lobbyCode) === params.lobbyCode;
}
