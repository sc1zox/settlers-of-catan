import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import {
  PlayerHarborRatesDto,
  ResourceType,
  TradeOfferDto,
  TradeUpdateKind,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Subscription } from 'rxjs';
import { GameSocketService } from '../../core/socket/game-socket.service';
import type { TradePartner } from '../trading/trading-ui.types';
import { LobbyGameUiStateService } from './lobby-game-ui-state.service';

const ZERO_RESOURCES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.Wood]: 0,
  [ResourceType.Brick]: 0,
  [ResourceType.Wheat]: 0,
  [ResourceType.Wool]: 0,
  [ResourceType.Ore]: 0,
};

const DEFAULT_HARBOR_RATES: PlayerHarborRatesDto = {
  generic: 4,
  perResource: {
    [ResourceType.Wood]: 4,
    [ResourceType.Brick]: 4,
    [ResourceType.Wheat]: 4,
    [ResourceType.Wool]: 4,
    [ResourceType.Ore]: 4,
  },
};

@Injectable({ providedIn: 'root' })
export class LobbyTradeUiService implements OnDestroy {
  private readonly state = inject(LobbyGameUiStateService);
  private readonly sockets = inject(GameSocketService);

  public readonly tradePartners = computed<readonly TradePartner[]>(() => {
    const payload = this.state.rawLobbyState();
    if (payload === undefined) {
      return [];
    }
    return payload.players
      .filter((player) => !player.isSelf)
      .map((player) => ({ seat: player.seat, name: player.displayName }));
  });

  /**
   * The single open trade thread involving the current viewer, or null.
   *
   * Contract:
   *  - At most ONE open trade per lobby — server enforces this by superseding
   *    the previous thread before creating a new one (see
   *    `TradeActionsService.proposeTrade`). Both events go out on the same
   *    socket in order (Superseded → Created), so we can apply each delta
   *    blind without trade-id bookkeeping.
   *  - Server routes `TradeUpdated` only to involved sockets, so anything we
   *    receive is by definition for our viewer.
   *  - Resync re-emits the current thread when a socket rebinds to a lobby
   *    it has a seat in.
   *  - Lobby-scoped lifecycle (clearing on lobby switch / sign-out) is owned
   *    by `SessionCleanupService` and arrives via {@link resetSession}.
   */
  private readonly currentTrade = signal<TradeOfferDto | null>(null);
  public readonly pendingTrade = this.currentTrade.asReadonly();

  private tradeUpdatedSubscription: Subscription | null = null;

  public constructor() {
    this.tradeUpdatedSubscription = this.sockets.tradeUpdated$.subscribe((update) => {
      this.applyTradeUpdate(update);
    });
  }

  public ngOnDestroy(): void {
    if (this.tradeUpdatedSubscription !== null) {
      this.tradeUpdatedSubscription.unsubscribe();
      this.tradeUpdatedSubscription = null;
    }
  }

  /** Drop any cached thread. Called by the session cleanup coordinator. */
  public resetSession(): void {
    this.currentTrade.set(null);
  }

  public readonly selfResources = computed<Readonly<Record<ResourceType, number>>>(
    () => this.state.selfPlayer()?.resources ?? ZERO_RESOURCES,
  );

  public readonly selfHarborRates = computed<PlayerHarborRatesDto>(
    () => this.state.selfPlayer()?.harborRates ?? DEFAULT_HARBOR_RATES,
  );

  public readonly selfHasOpenTrade = computed<boolean>(() => this.pendingTrade() !== null);

  private applyTradeUpdate(update: TradeUpdatedPayload): void {
    switch (update.kind) {
      case TradeUpdateKind.Created:
      case TradeUpdateKind.RecipientAccepted:
      case TradeUpdateKind.RecipientCountered:
      case TradeUpdateKind.RecipientCounterWithdrawn:
      case TradeUpdateKind.RecipientRejected:
      case TradeUpdateKind.Resync:
        this.currentTrade.set(update.trade);
        return;
      case TradeUpdateKind.Cancelled:
      case TradeUpdateKind.Finalized:
      case TradeUpdateKind.Superseded:
      case TradeUpdateKind.PhaseClosed:
        this.currentTrade.set(null);
        return;
    }
  }
}
