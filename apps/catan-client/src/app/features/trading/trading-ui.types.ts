import { PlayerSeat, ResourceType } from '@catan/api-interfaces';

export enum TradePanelMode {
  Sender = 'sender',
  Recipient = 'recipient',
  Composer = 'composer',
  Counter = 'counter',
}

export enum TradeComposerView {
  Bank = 'bank',
  Player = 'player',
}

export enum TradeResourceSide {
  Offer = 'offer',
  Request = 'request',
}

export interface TradePartner {
  readonly seat: PlayerSeat;
  readonly name: string;
}

export interface BankTradeRequest {
  readonly give: ResourceType;
  readonly amount: number;
  readonly receive: ResourceType;
}

export interface ProposeTradeRequest {
  readonly recipients: readonly PlayerSeat[];
  readonly offer: Readonly<Record<ResourceType, number>>;
  readonly request: Readonly<Record<ResourceType, number>>;
}

export interface CounterTradeRequest {
  readonly tradeId: string;
  /** Sender perspective: what the sender would give. */
  readonly offer: Readonly<Record<ResourceType, number>>;
  /** Sender perspective: what the sender would receive. */
  readonly request: Readonly<Record<ResourceType, number>>;
}

export interface FinalizeTradeRequest {
  readonly tradeId: string;
  readonly recipientSeat: PlayerSeat;
}
