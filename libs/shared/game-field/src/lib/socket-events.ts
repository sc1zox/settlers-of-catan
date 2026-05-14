import { GameBoardLayout } from './game-board-layout';

export enum GameSocketClientEvent {
  JoinSession = 'game:joinSession',
}

export enum GameSocketServerEvent {
  SessionJoined = 'game:sessionJoined',
  BoardLayout = 'game:boardLayout',
}

export interface JoinSessionPayload {
  readonly sessionId: string;
}

export interface SessionJoinedPayload {
  readonly sessionId: string;
}

export type BoardLayoutPayload = GameBoardLayout;
