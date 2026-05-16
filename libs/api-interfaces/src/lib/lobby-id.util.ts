const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOBBY_CODE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/;

export const LOBBY_CODE_MIN_LENGTH = 2;
export const LOBBY_CODE_MAX_LENGTH = 32;

export function normalizeLobbyCode(lobbyCode: string): string {
  return lobbyCode.trim().toLowerCase();
}

export function isLobbyCodeValid(lobbyCode: string): boolean {
  const trimmed = lobbyCode.trim();
  if (trimmed.length < LOBBY_CODE_MIN_LENGTH || trimmed.length > LOBBY_CODE_MAX_LENGTH) {
    return false;
  }
  return LOBBY_CODE_PATTERN.test(trimmed);
}

export function isCanonicalLobbyId(lobbyId: string): boolean {
  return UUID_V4_PATTERN.test(lobbyId);
}
