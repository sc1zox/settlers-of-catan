import { PlayerSeat } from './player-seat.enum';
import { ResourceType } from './resource-type.enum';
import { TradeStatus } from './trade-status.enum';

export enum TradeRecipientStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Countered = 'countered',
}

/**
 * Per-recipient slot within a trade thread. `counter` is filled when the
 * recipient sent back a counter-proposal — stored in the SENDER's
 * perspective (i.e. counter.offer = what the sender would give, counter.request
 * = what the sender would receive under the counter).
 */
export interface TradeRecipientResponse {
  readonly seat: PlayerSeat;
  readonly status: TradeRecipientStatus;
  readonly counter?: {
    readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
    readonly request: Readonly<Partial<Record<ResourceType, number>>>;
  };
}

export interface TradeOfferDto {
  readonly id: string;
  readonly lobbyId: string;
  readonly fromSeat: PlayerSeat;
  /**
   * Original sender offer (sender perspective): `offer` is what sender gives,
   * `request` is what sender receives.
   */
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
  readonly recipients: readonly TradeRecipientResponse[];
  readonly status: TradeStatus;
  /** Set once the sender finalises against a specific recipient. */
  readonly finalizedWithSeat?: PlayerSeat;
}

export interface TradeProposePayload {
  readonly lobbyId: string;
  /** Length 1 = single-target. Length > 1 = broadcast. */
  readonly recipients: readonly PlayerSeat[];
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
}

/** Recipient accepts the original offer as-is. */
export interface TradeAcceptPayload {
  readonly lobbyId: string;
  readonly tradeId: string;
}

/**
 * Either: recipient rejects their own response slot, OR sender cancels the
 * whole thread (server distinguishes by actor seat).
 */
export interface TradeRejectPayload {
  readonly lobbyId: string;
  readonly tradeId: string;
}

/** Recipient sends a counter-proposal (stored in sender perspective). */
export interface TradeCounterPayload {
  readonly lobbyId: string;
  readonly tradeId: string;
  readonly offer: Readonly<Partial<Record<ResourceType, number>>>;
  readonly request: Readonly<Partial<Record<ResourceType, number>>>;
}

/**
 * Sender picks which recipient slot to actually transact with. Server
 * uses that slot's counter if status=Countered, original offer otherwise.
 */
export interface TradeFinalizePayload {
  readonly lobbyId: string;
  readonly tradeId: string;
  readonly recipientSeat: PlayerSeat;
}

export interface TradeUpdatedPayload {
  readonly lobbyId: string;
  readonly trade: TradeOfferDto;
}
