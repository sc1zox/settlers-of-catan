export interface LobbyRejoinAvailableRequestDto {
  readonly lobbyCode: string;
}

export interface LobbyRejoinAvailableResponseDto {
  readonly available: boolean;
  readonly lobbyCode?: string;
}
