import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ClientConnectErrorCode,
  PlayerSeat,
  ResourceType,
  normalizeLobbyCode,
  type BonusAwardedPayload,
  type DiceRolledPayload,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { firstValueFrom, merge, of, TimeoutError } from 'rxjs';
import { filter, map, take, timeout } from 'rxjs/operators';
import { GameSocketService } from '../socket/game-socket.service';
import { rxResourceStream } from '../../../shared/http/rx-resource-stream';
import { matchesLobbyConnection } from '../../features/lobby-game-ui/matches-lobby-connection';
import type { LobbyConnectionParams } from './lobby-connection-params';

export type { LobbyConnectionParams };

interface LobbySubscriptionParams {
  readonly lobbyCode: string;
  readonly displayName: string;
}

@Injectable({ providedIn: 'root' })
export class GameStateResource {
  private readonly sockets = inject(GameSocketService);

  private readonly subscriptionParamsSignal = signal<LobbySubscriptionParams | undefined>(undefined);
  private readonly canonicalLobbyIdSignal = signal<string>('');

  public readonly subscriptionParams = this.subscriptionParamsSignal.asReadonly();
  public readonly canonicalLobbyId = this.canonicalLobbyIdSignal.asReadonly();

  public readonly connection = computed<LobbyConnectionParams | undefined>(() => {
    const subscription = this.subscriptionParams();
    if (subscription === undefined) {
      return undefined;
    }
    return {
      lobbyId: this.canonicalLobbyId(),
      lobbyCode: subscription.lobbyCode,
      displayName: subscription.displayName,
    };
  });

  public readonly lobby = rxResource<
    LobbyFullStatePayload | undefined,
    LobbySubscriptionParams | undefined
  >({
    params: () => this.subscriptionParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return of(undefined);
      }
      return rxResourceStream(
        this.sockets.fullState$.pipe(
          filter((state) =>
            matchesLobbyConnection(state.lobbyId, state.lobbyCode, {
              lobbyId: '',
              lobbyCode: params.lobbyCode,
              displayName: params.displayName,
            }),
          ),
        ),
        abortSignal,
        undefined,
      );
    },
    defaultValue: undefined,
  });

  public readonly diceRolled = rxResource<
    DiceRolledPayload | undefined,
    LobbySubscriptionParams | undefined
  >({
    params: () => this.subscriptionParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return of(undefined);
      }
      const lobbyCode = params.lobbyCode;
      return rxResourceStream(
        this.sockets.diceRolled$.pipe(
          filter((payload) => {
            const canonical = this.canonicalLobbyId();
            if (canonical.length === 0) {
              return false;
            }
            return payload.lobbyId === canonical && lobbyCode.length > 0;
          }),
        ),
        abortSignal,
        undefined,
      );
    },
    defaultValue: undefined,
  });

  public readonly bonusAwarded = rxResource<
    BonusAwardedPayload | undefined,
    LobbySubscriptionParams | undefined
  >({
    params: () => this.subscriptionParams(),
    stream: ({ params, abortSignal }) => {
      if (params === undefined) {
        return of(undefined);
      }
      const lobbyCode = params.lobbyCode;
      return rxResourceStream(
        this.sockets.bonusAwarded$.pipe(
          filter((payload) => {
            const canonical = this.canonicalLobbyId();
            if (canonical.length === 0) {
              return false;
            }
            return payload.lobbyId === canonical && lobbyCode.length > 0;
          }),
        ),
        abortSignal,
        undefined,
      );
    },
    defaultValue: undefined,
  });

  public async joinLobby(lobbyCodeInput: string, displayName: string): Promise<LobbyJoinedPayload> {
    return this.connectToLobby(lobbyCodeInput, displayName, 'join');
  }

  public async createLobby(
    lobbyCodeInput: string,
    displayName: string,
  ): Promise<LobbyJoinedPayload> {
    return this.connectToLobby(lobbyCodeInput, displayName, 'create');
  }

  private async connectToLobby(
    lobbyCodeInput: string,
    displayName: string,
    mode: 'create' | 'join',
  ): Promise<LobbyJoinedPayload> {
    const lobbyCode = normalizeLobbyCode(lobbyCodeInput);
    try {
      await this.sockets.connect();
      this.canonicalLobbyIdSignal.set('');
      this.subscriptionParamsSignal.set({ lobbyCode, displayName });
      if (mode === 'create') {
        this.sockets.createLobby(lobbyCodeInput.trim(), displayName);
      } else {
        this.sockets.joinLobby(lobbyCodeInput.trim(), displayName);
      }
      const joinedSignal$ = this.sockets.lobbyJoined$.pipe(
        filter((payload) => payload.lobbyCode === lobbyCode),
        map((payload) => ({ kind: 'joined' as const, payload })),
      );
      const rejectedSignal$ = this.sockets.actionRejected$.pipe(
        map((payload) => ({ kind: 'rejected' as const, payload })),
      );
      const outcome = await firstValueFrom(
        merge(joinedSignal$, rejectedSignal$).pipe(take(1), timeout(15_000)),
      );
      if (outcome.kind === 'rejected') {
        throw new Error(outcome.payload.code);
      }
      this.canonicalLobbyIdSignal.set(outcome.payload.lobbyId);
      return outcome.payload;
    } catch (error: unknown) {
      this.subscriptionParamsSignal.set(undefined);
      this.canonicalLobbyIdSignal.set('');
      if (error instanceof TimeoutError) {
        throw new Error(ClientConnectErrorCode.SocketConnectTimeout);
      }
      throw error;
    }
  }

  public startLobby(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.startLobby(lobbyId);
  }

  public fillLobbyWithBots(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.fillLobbyWithBots(lobbyId);
  }

  public rollDice(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.rollDice(lobbyId);
  }

  public endTurn(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.endTurn(lobbyId);
  }

  public buildSettlement(vertexId: string): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.buildSettlement(lobbyId, vertexId);
  }

  public buildRoad(edgeId: string): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.buildRoad(lobbyId, edgeId);
  }

  public buildCity(vertexId: string): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.buildCity(lobbyId, vertexId);
  }

  public buyDevCard(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.buyDevCard(lobbyId);
  }

  public submitRobberDiscard(discard: Readonly<Partial<Record<ResourceType, number>>>): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.submitRobberDiscard(lobbyId, discard);
  }

  public moveRobber(q: number, r: number, victimSeat?: PlayerSeat): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.moveRobber(lobbyId, q, r, victimSeat);
  }

  public playKnight(q: number, r: number, victimSeat?: PlayerSeat): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.playKnight(lobbyId, q, r, victimSeat);
  }

  public playMonopoly(resource: ResourceType): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.playMonopoly(lobbyId, resource);
  }

  public playYearOfPlenty(first: ResourceType, second: ResourceType): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.playYearOfPlenty(lobbyId, first, second);
  }

  public playRoadBuilding(firstEdgeId: string, secondEdgeId?: string): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.playRoadBuilding(lobbyId, firstEdgeId, secondEdgeId);
  }

  public leaveLobby(): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.leaveLobby(lobbyId);
  }

  public kickAndReplaceWithBot(seat: PlayerSeat): void {
    const lobbyId = this.canonicalLobbyId();
    if (lobbyId.length === 0) {
      return;
    }
    this.sockets.kickAndReplaceWithBot(lobbyId, seat);
  }

  public disconnectLobby(): void {
    this.subscriptionParamsSignal.set(undefined);
    this.canonicalLobbyIdSignal.set('');
  }
}
