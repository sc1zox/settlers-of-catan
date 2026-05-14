import { ActionRejectCode } from './action-reject-code.enum';
import { PlayerSeat } from './player-seat.enum';

export interface ActionRejectedPayload {
  readonly code: ActionRejectCode;
  readonly message: string;
}

export interface SessionBoundPayload {
  readonly sessionToken: string;
}

export interface JoinLobbyPayload {
  readonly lobbyId: string;
  readonly displayName: string;
}

export interface LobbyJoinedPayload {
  readonly lobbyId: string;
  readonly seat: PlayerSeat;
}

export interface BuildSettlementPayload {
  readonly lobbyId: string;
  readonly q: number;
  readonly r: number;
}

export enum GameSocketClientEvent {
  JoinLobby = 'game:joinLobby',
  BuildSettlement = 'game:buildSettlement',
  TradePropose = 'game:tradePropose',
  TradeAccept = 'game:tradeAccept',
  TradeReject = 'game:tradeReject',
}

export enum GameSocketServerEvent {
  SessionBound = 'game:sessionBound',
  LobbyJoined = 'game:lobbyJoined',
  FullState = 'game:fullState',
  GameDelta = 'game:gameDelta',
  TradeUpdated = 'game:tradeUpdated',
  ActionRejected = 'game:actionRejected',
}
