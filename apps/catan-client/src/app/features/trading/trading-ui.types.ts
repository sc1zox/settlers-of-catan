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

/**
 * Tag for an in-flight trade socket call so the panel can show a spinner /
 * disabled state on exactly the button the user just pressed and clear it as
 * soon as the matching server echo arrives.
 */
export enum TradePendingActionKind {
  Propose = 'propose',
  Counter = 'counter',
  WithdrawCounter = 'withdraw_counter',
  Accept = 'accept',
  Reject = 'reject',
  Finalize = 'finalize',
  Bank = 'bank',
}

export interface TradePendingAction {
  readonly kind: TradePendingActionKind;
  /** Empty until the server has assigned an id (Propose / Bank). */
  readonly tradeId: string | null;
  readonly startedAtMs: number;
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
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
}

export interface CounterTradeRequest {
  readonly tradeId: string;
  /** Sender perspective: what the sender would give. */
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  /** Sender perspective: what the sender would receive. */
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
}

export interface FinalizeTradeRequest {
  readonly tradeId: string;
  readonly recipientSeat: PlayerSeat;
}
