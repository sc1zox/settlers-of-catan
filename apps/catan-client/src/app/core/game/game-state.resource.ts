import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  PlayerSeat,
  ResourceType,
  normalizeLobbyCode,
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

@Injectable({ providedIn: 'root' })
export class GameStateResource {
  private readonly sockets = inject(GameSocketService);

  private readonly lobbyParams = signal<LobbyConnectionParams | undefined>(undefined);

  public readonly connection = this.lobbyParams.asReadonly();

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
        filter((state) => matchesLobbyConnection(state.lobbyId, state.lobbyCode, params)),
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
        filter((payload) => params.lobbyId.length > 0 && payload.lobbyId === params.lobbyId),
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
      this.lobbyParams.set({ lobbyId: '', lobbyCode, displayName });
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
      this.lobbyParams.set({
        lobbyId: joined.lobbyId,
        lobbyCode: joined.lobbyCode,
        displayName,
      });
      return joined;
    } catch (error) {
      this.lobbyParams.set(undefined);
      throw error;
    }
  }

  public startLobby(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.startLobby(params.lobbyId);
  }

  public fillLobbyWithBots(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.fillLobbyWithBots(params.lobbyId);
  }

  public rollDice(): void {
    const params = this.lobbyParams();
    if (params === undefined) {
      return;
    }
    this.sockets.rollDice(params.lobbyId);
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

  public submitRobberDiscard(discard: Readonly<Partial<Record<ResourceType, number>>>): void {
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

  public leaveLobby(): void {
    const params = this.lobbyParams();
    if (params === undefined || params.lobbyId.length === 0) {
      return;
    }
    this.sockets.leaveLobby(params.lobbyId);
  }

  public disconnectLobby(): void {
    this.lobbyParams.set(undefined);
  }
}
