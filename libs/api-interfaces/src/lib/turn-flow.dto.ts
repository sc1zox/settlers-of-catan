import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';

export interface AxialCoordDto {
  readonly q: number;
  readonly r: number;
}

export interface DiceRollDto {
  readonly a: number;
  readonly b: number;
  readonly sum: number;
}

export interface RollDicePayload {
  readonly lobbyId: string;
}

export interface DiceRolledPayload {
  readonly lobbyId: string;
  readonly rollerSeat: PlayerSeat;
  readonly roll: DiceRollDto;
}

export interface FinishTradingPayload {
  readonly lobbyId: string;
}

export interface EndTurnPayload {
  readonly lobbyId: string;
}

export interface RobberDiscardPayload {
  readonly lobbyId: string;
  readonly discard: Readonly<Partial<Record<ResourceType, number>>>;
}

export interface MoveRobberPayload {
  readonly lobbyId: string;
  readonly q: number;
  readonly r: number;
  readonly victimSeat?: PlayerSeat;
}
