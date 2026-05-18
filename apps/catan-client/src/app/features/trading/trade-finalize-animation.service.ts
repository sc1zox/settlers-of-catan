import { effect, inject, Injectable, signal } from '@angular/core';
import { PlayerSeat, ResourceType, TradeUpdateKind } from '@catan/api-interfaces';
import { resolveFinalizedTradeSwap } from './trade-finalized-swap.util';
import { TradeSessionService } from './trade-session.service';

interface TradeSwapAnimationRequest {
  readonly tradeId: string;
  readonly fromSeat: PlayerSeat;
  readonly recipientSeat: PlayerSeat;
  readonly give: Readonly<Partial<Record<ResourceType, number>>>;
  readonly take: Readonly<Partial<Record<ResourceType, number>>>;
}

/**
 * Derives finalized-trade card-swap payloads for the 3D engine. Keeps
 * game-canvas free of trade socket / FSM details.
 */
@Injectable({ providedIn: 'root' })
export class TradeFinalizeAnimationService {
  private readonly tradeSession = inject(TradeSessionService);

  private lastAnimatedTradeId: string | null = null;
  public readonly swapRequest = signal<TradeSwapAnimationRequest | null>(null);

  public constructor() {
    effect(() => {
      const update = this.tradeSession.lastTradeUpdate();
      if (update === undefined || update.kind !== TradeUpdateKind.Finalized) {
        return;
      }
      const trade = update.trade;
      if (trade.id === this.lastAnimatedTradeId) {
        return;
      }
      const recipientSeat = trade.finalizedWithSeat;
      if (recipientSeat === undefined) {
        return;
      }
      const maps = resolveFinalizedTradeSwap(
        trade.recipients,
        recipientSeat,
        trade.offer,
        trade.request,
      );
      if (maps === null) {
        return;
      }
      this.lastAnimatedTradeId = trade.id;
      this.swapRequest.set({
        tradeId: trade.id,
        fromSeat: trade.fromSeat,
        recipientSeat,
        give: maps.give,
        take: maps.take,
      });
    });
  }

  public consumePendingSwap(): void {
    this.swapRequest.set(null);
  }

  public resetSession(): void {
    this.lastAnimatedTradeId = null;
    this.swapRequest.set(null);
  }
}
