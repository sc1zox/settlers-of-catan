import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  PlayerSeat,
  ResourceType,
  type DiceRolledPayload,
  type LobbyFullStatePayload,
  type TradeUpdatedPayload,
} from '@catan/api-interfaces';
import { EMPTY } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { GameSocketService } from '../socket/game-socket.service';
import { observeAbort } from '../../shared/helper/http/observe-abort';

export interface LobbyConnectionParams {
  readonly lobbyId: string;
  readonly displayName: string;
}

@Injectable({ providedIn: 'root' })
export class GameStateResource {
  private readonly sockets = inject(GameSocketService);

  private readonly lobbyParams = signal<LobbyConnectionParams | undefined>(undefined);

  public readonly lobby = rxResource<
    LobbyFullStatePayload | undefined,
    LobbyConnectionParams | undefined
  >({
    params: () => this.lobbyParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return EMPTY;
      }
      return this.sockets.fullState$.pipe(
        filter((state) => state.lobbyId === params.lobbyId),
        takeUntil(observeAbort(abortSignal)),
      );
    },
    defaultValue: undefined,
  });

  public readonly tradeUpdated = rxResource<
    TradeUpdatedPayload | undefined,
    LobbyConnectionParams | undefined
  >({
    params: () => this.lobbyParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return EMPTY;
      }
      return this.sockets.tradeUpdated$.pipe(
        filter((state) => state.lobbyId === params.lobbyId),
        takeUntil(observeAbort(abortSignal)),
      );
    },
    defaultValue: undefined,
  });

  public readonly diceRolled = rxResource<
    DiceRolledPayload | undefined,
    LobbyConnectionParams | undefined
  >({
    params: () => this.lobbyParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return EMPTY;
      }
      return this.sockets.diceRolled$.pipe(
        filter((payload) => payload.lobbyId === params.lobbyId),
        takeUntil(observeAbort(abortSignal)),
      );
    },
    defaultValue: undefined,
  });

  public async connectToLobby(lobbyId: string, displayName: string): Promise<void> {
    await this.sockets.connect();
    this.lobbyParams.set({ lobbyId, displayName });
    this.sockets.joinLobby(lobbyId, displayName);
  }

  public startLobby(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.startLobby(params.lobbyId);
  }

  public rollDice(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.rollDice(params.lobbyId);
  }

  public finishTrading(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.finishTrading(params.lobbyId);
  }

  public endTurn(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.endTurn(params.lobbyId);
  }

  public buildSettlement(vertexId: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.buildSettlement(params.lobbyId, vertexId);
  }

  public buildRoad(edgeId: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.buildRoad(params.lobbyId, edgeId);
  }

  public buildCity(vertexId: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.buildCity(params.lobbyId, vertexId);
  }

  public buyDevCard(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.buyDevCard(params.lobbyId);
  }

  public submitRobberDiscard(
    discard: Readonly<Partial<Record<ResourceType, number>>>,
  ): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.submitRobberDiscard(params.lobbyId, discard);
  }

  public moveRobber(q: number, r: number, victimSeat?: PlayerSeat): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.moveRobber(params.lobbyId, q, r, victimSeat);
  }

  public playKnight(q: number, r: number, victimSeat?: PlayerSeat): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.playKnight(params.lobbyId, q, r, victimSeat);
  }

  public playMonopoly(resource: ResourceType): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.playMonopoly(params.lobbyId, resource);
  }

  public playYearOfPlenty(first: ResourceType, second: ResourceType): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.playYearOfPlenty(params.lobbyId, first, second);
  }

  public playRoadBuilding(firstEdgeId: string, secondEdgeId?: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.playRoadBuilding(params.lobbyId, firstEdgeId, secondEdgeId);
  }

  public bankTrade(
    giveResource: ResourceType,
    giveAmount: number,
    receiveResource: ResourceType,
  ): void {
    const params = this.lobbyParams();
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
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.proposeTrade(params.lobbyId, toSeat, offer, request);
  }

  public acceptTrade(tradeId: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.acceptTrade(params.lobbyId, tradeId);
  }

  public rejectTrade(tradeId: string): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.rejectTrade(params.lobbyId, tradeId);
  }

  public disconnectLobby(): void {
    this.lobbyParams.set(undefined);
  }
}
