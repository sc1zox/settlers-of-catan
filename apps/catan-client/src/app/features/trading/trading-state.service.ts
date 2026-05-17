import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PlayerSeat, ResourceType, type TradeUpdatedPayload } from '@catan/api-interfaces';
import { of } from 'rxjs';
import { filter } from 'rxjs/operators';
import { GameStateResource } from '../../core/game/game-state.resource';
import { GameSocketService } from '../../core/socket/game-socket.service';
import { rxResourceStream } from '../../../shared/http/rx-resource-stream';

@Injectable({ providedIn: 'root' })
export class TradingStateService {
  private readonly sockets = inject(GameSocketService);
  private readonly gameState = inject(GameStateResource);

  public readonly tradeUpdated = rxResource<TradeUpdatedPayload | undefined, boolean>({
    params: () => this.gameState.subscriptionParams() !== undefined,
    stream: ({ params: active, abortSignal }) => {
      if (!active) {
        return of(undefined);
      }
      return rxResourceStream(
        this.sockets.tradeUpdated$.pipe(
          filter((payload) => {
            const canonical = this.gameState.canonicalLobbyId();
            return canonical.length > 0 && payload.lobbyId === canonical;
          }),
        ),
        abortSignal,
        undefined,
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

  public finalizeTrade(tradeId: string, recipientSeat: PlayerSeat): void {
    const params = this.gameState.connection();
    if (params === undefined) {
      return;
    }
    this.sockets.finalizeTrade(params.lobbyId, tradeId, recipientSeat);
  }
}
