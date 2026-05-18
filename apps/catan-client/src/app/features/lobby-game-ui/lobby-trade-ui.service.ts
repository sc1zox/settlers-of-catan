import { computed, effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
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
   * The single open trade involving the current viewer, or null.
   *
   * Server is the only writer. FullState no longer carries trades — the
   * board doesn't care who's haggling — so the cache is driven exclusively
   * by `TradeUpdated`:
   *  - action events (Created / Recipient* / etc.) only reach involved
   *    sockets, so we apply each delta blind.
   *  - Resync events are pushed on reconnect/join when the new socket
   *    belongs to a seat that's already in an open thread.
   *  - the cache is cleared when we lose the lobby binding (lobby switch
   *    or sign-out) — without that, a stale trade from the previous lobby
   *    would survive.
   */
  private readonly currentTrade = signal<TradeOfferDto | null>(null);
  public readonly pendingTrade = this.currentTrade.asReadonly();

  private tradeUpdatedSubscription: Subscription | null = null;
  private lastLobbyId: string | null = null;

  public constructor() {
    effect(() => {
      const payload = this.state.rawLobbyState();
      const lobbyId = payload?.lobbyId ?? null;
      if (lobbyId === this.lastLobbyId) {
        return;
      }
      this.lastLobbyId = lobbyId;
      if (this.currentTrade() !== null) {
        this.currentTrade.set(null);
      }
    });
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

  public readonly selfResources = computed<Readonly<Record<ResourceType, number>>>(
    () => this.state.selfPlayer()?.resources ?? ZERO_RESOURCES,
  );

  public readonly selfHarborRates = computed<PlayerHarborRatesDto>(
    () => this.state.selfPlayer()?.harborRates ?? DEFAULT_HARBOR_RATES,
  );

  public readonly selfHasOpenTrade = computed<boolean>(() => this.pendingTrade() !== null);

  private applyTradeUpdate(update: TradeUpdatedPayload): void {
    // Server routes TradeUpdated only to involved sockets, so anything that
    // reaches us is by definition for our viewer.
    switch (update.kind) {
      case TradeUpdateKind.Created:
      case TradeUpdateKind.RecipientAccepted:
      case TradeUpdateKind.RecipientCountered:
      case TradeUpdateKind.RecipientCounterWithdrawn:
      case TradeUpdateKind.RecipientRejected:
      case TradeUpdateKind.Resync:
        if (this.currentTrade() !== update.trade) {
          this.currentTrade.set(update.trade);
        }
        break;
      case TradeUpdateKind.Cancelled:
      case TradeUpdateKind.Finalized:
      case TradeUpdateKind.Superseded:
      case TradeUpdateKind.PhaseClosed:
        if (this.currentTrade() !== null) {
          this.currentTrade.set(null);
        }
        break;
    }
  }
}
