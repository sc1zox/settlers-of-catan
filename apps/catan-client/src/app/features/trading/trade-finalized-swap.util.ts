import {
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  type TradeRecipientResponse,
} from '@catan/api-interfaces';

export interface TradeFinalizedSwapMaps {
  readonly give: Readonly<Partial<Record<ResourceType, number>>>;
  readonly take: Readonly<Partial<Record<ResourceType, number>>>;
}

/**
 * Mirror the server's finalize-trade resource accounting: the recipient slot's
 * counter wins when present; otherwise the original offer is used. Maps are in
 * sender perspective (give = sender → recipient, take = recipient → sender).
 */
export function resolveFinalizedTradeSwap(
  recipients: readonly TradeRecipientResponse[],
  recipientSeat: PlayerSeat,
  originalOffer: Readonly<Partial<Record<ResourceType, number>>>,
  originalRequest: Readonly<Partial<Record<ResourceType, number>>>,
): TradeFinalizedSwapMaps | null {
  for (let i = 0; i < recipients.length; i += 1) {
    const slot = recipients[i];
    if (slot.seat !== recipientSeat) {
      continue;
    }
    if (slot.status === TradeRecipientStatus.Countered && slot.counter !== undefined) {
      return { give: slot.counter.offer, take: slot.counter.request };
    }
    return { give: originalOffer, take: originalRequest };
  }
  return null;
}
