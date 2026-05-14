import type { TilePlacement } from '@catan/shared-game-field';
import { GamePhase } from './game-phase.enum';
import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';

export enum GameDeltaType {
  SettlementBuilt = 'SETTLEMENT_BUILT',
}

export interface SettlementBuiltDelta {
  readonly type: GameDeltaType.SettlementBuilt;
  readonly seat: PlayerSeat;
  readonly q: number;
  readonly r: number;
}

export type GameDeltaPayload = SettlementBuiltDelta;

export interface LobbyPlayerPublicDto {
  readonly seat: PlayerSeat;
  readonly displayName: string;
  readonly isConnected: boolean;
  readonly isSelf: boolean;
  readonly resources: Readonly<Record<ResourceType, number>>;
}

export interface LobbyFullStatePayload {
  readonly lobbyId: string;
  readonly phase: GamePhase;
  readonly currentSeat: PlayerSeat;
  readonly seed: number;
  readonly tiles: readonly TilePlacement[];
  readonly players: readonly LobbyPlayerPublicDto[];
}
