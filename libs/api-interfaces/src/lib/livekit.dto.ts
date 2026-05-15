import { PlayerSeat } from './player-seat.enum';

export interface LiveKitCredentialsPayload {
  readonly serverUrl: string;
  readonly token: string;
  readonly roomName: string;
}

export interface CreateLobbyResponseDto {
  readonly lobbyId: string;
  readonly lobbyCode: string;
}

export interface LobbyMemberRedisRecord {
  readonly sessionToken: string;
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly isBot: boolean;
}
