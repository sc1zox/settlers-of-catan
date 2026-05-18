import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import {
  PlayerHarborRatesDto,
  PlayerSeat,
  ResourceType,
  TradeOfferDto,
  TradeUpdateKind,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import type { Subscription } from 'rxjs';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import type { TradePartner } from './trading-ui.types';

const TRADE_CACHE_OPEN_KINDS: ReadonlySet<TradeUpdateKind> = new Set([
  TradeUpdateKind.Created,
  TradeUpdateKind.RecipientAccepted,
  TradeUpdateKind.RecipientCountered,
  TradeUpdateKind.RecipientCounterWithdrawn,
  TradeUpdateKind.RecipientRejected,
  TradeUpdateKind.Resync,
]);

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

/**
 * Single owner of player-to-player trade wire state on the client: open-thread
 * cache, last inbound update, and socket emits. Subscribes once to
 * `tradeUpdated$` (lobby-scoped by canonical id).
 */
@Injectable({ providedIn: 'root' })
export class TradeSessionService implements OnDestroy {
  private readonly sockets = inject(GameSocketService);
  private readonly gameState = inject(GameStateResource);

  private readonly currentTrade = signal<TradeOfferDto | null>(null);
  private readonly lastTradeUpdateSignal = signal<TradeUpdatedPayload | undefined>(undefined);

  public readonly pendingTrade = this.currentTrade.asReadonly();
  public readonly lastTradeUpdate = this.lastTradeUpdateSignal.asReadonly();

  private tradeUpdatedSubscription: Subscription | null = null;

  public constructor() {
    this.tradeUpdatedSubscription = this.sockets.tradeUpdated$.subscribe((update) => {
      const canonical = this.gameState.canonicalLobbyId();
      if (canonical.length === 0 || update.lobbyId !== canonical) {
        return;
      }
      this.applyTradeUpdate(update);
      this.lastTradeUpdateSignal.set(update);
    });
  }

  public ngOnDestroy(): void {
    if (this.tradeUpdatedSubscription !== null) {
      this.tradeUpdatedSubscription.unsubscribe();
      this.tradeUpdatedSubscription = null;
    }
  }

  public readonly tradePartners = computed<readonly TradePartner[]>(() => {
    const payload = this.gameState.lobby.value();
    if (payload === undefined) {
      return [];
    }
    return payload.players
      .filter((player) => !player.isSelf)
      .map((player) => ({ seat: player.seat, name: player.displayName }));
  });

  public readonly selfResources = computed<Readonly<Record<ResourceType, number>>>(
    () => this.selfPlayer()?.resources ?? ZERO_RESOURCES,
  );

  public readonly selfHarborRates = computed<PlayerHarborRatesDto>(
    () => this.selfPlayer()?.harborRates ?? DEFAULT_HARBOR_RATES,
  );

  public readonly selfHasOpenTrade = computed<boolean>(() => this.pendingTrade() !== null);

  public resetSession(): void {
    this.currentTrade.set(null);
    this.lastTradeUpdateSignal.set(undefined);
  }

  public finishTrading(): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.finishTrading(params.lobbyId);
  }

  public bankTrade(
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
  ): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.bankTrade(params.lobbyId, giveResource, giveAmount, receiveResource);
  }

  public proposeTrade(
    recipients: readonly PlayerSeat[],
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.proposeTrade(params.lobbyId, recipients, offer, request);
  }

  public acceptTrade(tradeId: string): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.acceptTrade(params.lobbyId, tradeId);
  }

  public rejectTrade(tradeId: string): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.rejectTrade(params.lobbyId, tradeId);
  }

  public counterTrade(
    tradeId: string,
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.counterTrade(params.lobbyId, tradeId, offer, request);
  }

  public withdrawCounterTrade(tradeId: string): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.withdrawCounterTrade(params.lobbyId, tradeId);
  }

  public finalizeTrade(tradeId: string, recipientSeat: PlayerSeat): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.finalizeTrade(params.lobbyId, tradeId, recipientSeat);
  }

  private selfPlayer() {
    const payload = this.gameState.lobby.value();
    if (payload === undefined) {
      return undefined;
    }
    return payload.players.find((player) => player.isSelf);
  }

  private applyTradeUpdate(update: TradeUpdatedPayload): void {
    if (TRADE_CACHE_OPEN_KINDS.has(update.kind)) {
      this.currentTrade.set(update.trade);
      return;
    }
    this.currentTrade.set(null);
  }
}
