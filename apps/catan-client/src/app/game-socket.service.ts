import { Injectable, OnDestroy, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  ActionRejectedPayload,
  GameDeltaPayload,
  GameSocketClientEvent,
  GameSocketServerEvent,
  JoinLobbyPayload,
  LobbyFullStatePayload,
  SessionBoundPayload,
} from '@catan/api-interfaces';
import { environment } from '../environments/environment';
import { SessionTokenService } from './http/session-token.service';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private readonly sessionTokens = inject(SessionTokenService);

  private socket: Socket | null = null;

  public connect(): void {
    if (this.socket?.connected) {
      return;
    }
    const sessionToken = this.sessionTokens.ensureToken();
    const url = `${environment.apiBaseUrl}/game`;
    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      auth: { sessionToken },
    });
    this.socket.on(GameSocketServerEvent.SessionBound, (payload: SessionBoundPayload) => {
      this.sessionTokens.setTokenFromServer(payload.sessionToken);
    });
  }

  public ngOnDestroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  public joinLobby(lobbyId: string, displayName: string): void {
    const payload: JoinLobbyPayload = { lobbyId, displayName };
    this.socket?.emit(GameSocketClientEvent.JoinLobby, payload);
  }

  public onFullState(handler: (state: LobbyFullStatePayload) => void): void {
    this.socket?.on(GameSocketServerEvent.FullState, handler);
  }

  public onGameDelta(handler: (delta: GameDeltaPayload) => void): void {
    this.socket?.on(GameSocketServerEvent.GameDelta, handler);
  }

  public onActionRejected(handler: (payload: ActionRejectedPayload) => void): void {
    this.socket?.on(GameSocketServerEvent.ActionRejected, handler);
  }
}
