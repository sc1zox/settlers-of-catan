import { Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { LobbyFullStatePayload } from '@catan/api-interfaces';
import { EMPTY } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { GameSocketService } from '../game-socket.service';
import { observeAbort } from '../http/observe-abort';

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

  public connectToLobby(lobbyId: string, displayName: string): void {
    this.sockets.connect();
    this.lobbyParams.set({ lobbyId, displayName });
    this.sockets.joinLobby(lobbyId, displayName);
  }

  public disconnectLobby(): void {
    this.lobbyParams.set(undefined);
  }
}
