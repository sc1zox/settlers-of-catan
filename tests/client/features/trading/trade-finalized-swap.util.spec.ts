import {
  PlayerSeat,
  ResourceType,
  TradeRecipientStatus,
  type TradeRecipientResponse,
} from '@catan/api-interfaces';
import { resolveFinalizedTradeSwap } from '@catan/client/app/features/trading/trade-finalized-swap.util';

describe('resolveFinalizedTradeSwap', () => {
  const originalOffer = { [ResourceType.Wood]: 2 };
  const originalRequest = { [ResourceType.Wheat]: 1 };
  const recipientSeat = PlayerSeat.East;

  it('uses counter maps when recipient slot is Countered', () => {
    const recipients: readonly TradeRecipientResponse[] = [
      {
        seat: recipientSeat,
        status: TradeRecipientStatus.Countered,
        counter: {
          offer: { [ResourceType.Brick]: 1 },
          request: { [ResourceType.Ore]: 2 },
        },
      },
    ];
    const result = resolveFinalizedTradeSwap(
      recipients,
      recipientSeat,
      originalOffer,
      originalRequest,
    );
    expect(result).toEqual({
      give: { [ResourceType.Brick]: 1 },
      take: { [ResourceType.Ore]: 2 },
    });
  });

  it('uses original offer/request when slot is Accepted', () => {
    const recipients: readonly TradeRecipientResponse[] = [
      {
        seat: recipientSeat,
        status: TradeRecipientStatus.Accepted,
      },
    ];
    const result = resolveFinalizedTradeSwap(
      recipients,
      recipientSeat,
      originalOffer,
      originalRequest,
    );
    expect(result).toEqual({ give: originalOffer, take: originalRequest });
  });

  it('uses original offer/request when slot is Pending', () => {
    const recipients: readonly TradeRecipientResponse[] = [
      {
        seat: recipientSeat,
        status: TradeRecipientStatus.Pending,
      },
    ];
    const result = resolveFinalizedTradeSwap(
      recipients,
      recipientSeat,
      originalOffer,
      originalRequest,
    );
    expect(result).toEqual({ give: originalOffer, take: originalRequest });
  });

  it('returns null when recipient seat is not in the list', () => {
    const recipients: readonly TradeRecipientResponse[] = [
      {
        seat: PlayerSeat.North,
        status: TradeRecipientStatus.Accepted,
      },
    ];
    expect(
      resolveFinalizedTradeSwap(recipients, recipientSeat, originalOffer, originalRequest),
    ).toBeNull();
  });

  it('skips non-matching seats and finds the target', () => {
    const recipients: readonly TradeRecipientResponse[] = [
      { seat: PlayerSeat.North, status: TradeRecipientStatus.Pending },
      { seat: recipientSeat, status: TradeRecipientStatus.Accepted },
    ];
    const result = resolveFinalizedTradeSwap(
      recipients,
      recipientSeat,
      originalOffer,
      originalRequest,
    );
    expect(result).toEqual({ give: originalOffer, take: originalRequest });
  });
});
