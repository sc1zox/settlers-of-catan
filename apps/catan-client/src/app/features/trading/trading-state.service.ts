import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  PlayerSeat,
  ResourceType,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { EMPTY } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { observeAbort } from '../../shared/helper/http/observe-abort';
import type { LobbyConnectionParams } from '../../shared/types/lobby-connection-params';

@Injectable({ providedIn: 'root' })
export class TradingStateService {
  private readonly sockets = inject(GameSocketService);
  private readonly gameState = inject(GameStateResource);

  public readonly tradeUpdated = rxResource<
    TradeUpdatedPayload | undefined,
    LobbyConnectionParams | undefined
  >({
    params: () => this.gameState.connection(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return EMPTY;
      }
      return this.sockets.tradeUpdated$.pipe(
        filter((payload) => params.lobbyId.length > 0 && payload.lobbyId === params.lobbyId),
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
