import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PlayerSeat, ResourceType, type TradeUpdatedPayload } from '@catan/api-interfaces';
import { EMPTY } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { observeAbort } from '../../shared/helper/http/observe-abort';

@Injectable({ providedIn: 'root' })
export class TradingStateService {
  private readonly sockets = inject(GameSocketService);
  private readonly gameState = inject(GameStateResource);

  public readonly tradeUpdated = rxResource<TradeUpdatedPayload | undefined, boolean>({
    params: () => this.gameState.subscriptionParams() !== undefined,
    stream: ({ params: active, abortSignal }) => {
      if (!active) {
        return EMPTY;
      }
      return this.sockets.tradeUpdated$.pipe(
        filter((payload) => {
          const canonical = this.gameState.canonicalLobbyId();
          return canonical.length > 0 && payload.lobbyId === canonical;
        }),
        takeUntil(observeAbort(abortSignal)),
      );
    },
    defaultValue: undefined,
  });

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
    toSeat: PlayerSeat,
    offer: Readonly<Partial<Record<ResourceType, number>>>,
    request: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.proposeTrade(params.lobbyId, toSeat, offer, request);
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
}
