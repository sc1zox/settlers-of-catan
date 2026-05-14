import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
import { TradeStatus } from './trade-status.enum';

export interface TradeOfferDto {
  readonly id: string;
  readonly lobbyId: string;
  readonly fromSeat: PlayerSeat;
  readonly toSeat: PlayerSeat;
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
  readonly status: TradeStatus;
}

export interface TradeProposePayload {
  readonly lobbyId: string;
  readonly toSeat: PlayerSeat;
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
}

export interface TradeAcceptPayload {
  readonly lobbyId: string;
  readonly tradeId: string;
}

export interface TradeRejectPayload {
  readonly lobbyId: string;
  readonly tradeId: string;
}

export interface TradeUpdatedPayload {
  readonly lobbyId: string;
  readonly trade: TradeOfferDto;
}
