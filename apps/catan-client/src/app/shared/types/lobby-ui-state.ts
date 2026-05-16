import { GamePhase, PlayerSeat } from '@catan/api-interfaces';

export enum LobbyUiStep {
  SignIn = 'SIGN_IN',
  AvatarWardrobe = 'AVATAR_WARDROBE',
  JoinLobby = 'JOIN_LOBBY',
  Lobby = 'LOBBY',
  InGame = 'IN_GAME',
}

export enum UiFeedbackTone {
  Info = 'INFO',
  Success = 'SUCCESS',
  Error = 'ERROR',
}

export interface UiFeedbackState {
  readonly message: string;
  readonly tone: UiFeedbackTone;
}

export interface LobbyActivityFeedEntry {
  readonly id: string;
  readonly text: string;
}

export interface SessionUiState {
  readonly displayName: string;
  readonly sessionId: string;
}

export interface LobbySeatUiState {
  readonly seat: PlayerSeat;
  readonly seatLabel: string;
  readonly playerName: string;
  readonly isConnected: boolean;
  readonly isSelf: boolean;
}

export interface LobbyUiState {
  readonly lobbyId: string;
  readonly lobbyCode: string;
  readonly phase: GamePhase;
  readonly activeSeat: PlayerSeat;
  readonly adminSeat: PlayerSeat;
  readonly pendingRobberDiscardSeats: readonly PlayerSeat[];
  readonly pendingSetupRoadSeat: PlayerSeat | null;
  readonly pendingSetupRoadFromVertexId: string | null;
  readonly vertexIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly longestRoadSeat: PlayerSeat | null;
  readonly largestArmySeat: PlayerSeat | null;
  readonly winnerSeat: PlayerSeat | null;
  readonly seats: readonly LobbySeatUiState[];
}
