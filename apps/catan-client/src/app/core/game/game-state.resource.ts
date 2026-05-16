import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  PlayerSeat,
  ResourceType,
  normalizeLobbyCode,
  type BonusAwardedPayload,
  type DiceRolledPayload,
  type LobbyFullStatePayload,
  type LobbyJoinedPayload,
} from '@catan/api-interfaces';
import { EMPTY, firstValueFrom } from 'rxjs';
import { filter, take, takeUntil, timeout } from 'rxjs/operators';
import { GameSocketService } from '../socket/game-socket.service';
import { observeAbort } from '../../shared/helper/http/observe-abort';
import { matchesLobbyConnection } from '../../shared/helper/lobby-game-ui/matches-lobby-connection';
import type { LobbyConnectionParams } from '../../shared/types/lobby-connection-params';

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
        return EMPTY;
      }
      return this.sockets.fullState$.pipe(
        filter((state) =>
          matchesLobbyConnection(state.lobbyId, state.lobbyCode, {
            lobbyId: '',
            lobbyCode: params.lobbyCode,
            displayName: params.displayName,
          }),
        ),
        takeUntil(observeAbort(abortSignal)),
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
        return EMPTY;
      }
      const lobbyCode = params.lobbyCode;
      return this.sockets.diceRolled$.pipe(
        filter((payload) => {
          const canonical = this.canonicalLobbyId();
          if (canonical.length === 0) {
            return false;
          }
          return payload.lobbyId === canonical && lobbyCode.length > 0;
        }),
        takeUntil(observeAbort(abortSignal)),
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
        return EMPTY;
      }
      const lobbyCode = params.lobbyCode;
      return this.sockets.bonusAwarded$.pipe(
        filter((payload) => {
          const canonical = this.canonicalLobbyId();
          if (canonical.length === 0) {
            return false;
          }
          return payload.lobbyId === canonical && lobbyCode.length > 0;
        }),
        takeUntil(observeAbort(abortSignal)),
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
      const joined = await firstValueFrom(
        this.sockets.lobbyJoined$.pipe(
          filter((payload) => payload.lobbyCode === lobbyCode),
          take(1),
          timeout(15_000),
        ),
      );
      this.canonicalLobbyIdSignal.set(joined.lobbyId);
      return joined;
    } catch (error) {
      this.subscriptionParamsSignal.set(undefined);
      this.canonicalLobbyIdSignal.set('');
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

  public disconnectLobby(): void {
    this.subscriptionParamsSignal.set(undefined);
    this.canonicalLobbyIdSignal.set('');
  }
}
