import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
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

  private readonly fullStateSubject = new Subject<LobbyFullStatePayload>();
  private readonly gameDeltaSubject = new Subject<GameDeltaPayload>();
  private readonly actionRejectedSubject = new Subject<ActionRejectedPayload>();

  public readonly fullState$ = this.fullStateSubject.asObservable();
  public readonly gameDelta$ = this.gameDeltaSubject.asObservable();
  public readonly actionRejected$ = this.actionRejectedSubject.asObservable();

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
    this.socket.on(GameSocketServerEvent.FullState, (payload: LobbyFullStatePayload) => {
      this.fullStateSubject.next(payload);
    });
    this.socket.on(GameSocketServerEvent.GameDelta, (payload: GameDeltaPayload) => {
      this.gameDeltaSubject.next(payload);
    });
    this.socket.on(GameSocketServerEvent.ActionRejected, (payload: ActionRejectedPayload) => {
      this.actionRejectedSubject.next(payload);
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
}
